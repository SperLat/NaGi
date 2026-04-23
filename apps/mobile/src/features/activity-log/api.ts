import { localDb } from '@/lib/db';
import { db } from '@/lib/supabase';
import { enqueueOutbox } from '@/lib/sync/outbox';
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
  enqueueOutbox('activity_log', 'insert', entry as unknown as Record<string, unknown>);
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
