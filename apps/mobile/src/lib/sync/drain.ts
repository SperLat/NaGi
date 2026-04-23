// Outbox drain: sends pending local writes to the server in FIFO order.
import { localDb } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';

interface OutboxRow {
  id: string;
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  payload: string;
  attempts: number;
  status: string;
}

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

function markFailed(id: string, error: string): void {
  localDb.runSync(
    `UPDATE outbox SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?`,
    [error, id],
  );
}

function markSent(id: string): void {
  localDb.runSync(`UPDATE outbox SET status = 'sent' WHERE id = ?`, [id]);
}

export async function drainOutbox(): Promise<void> {
  if (isMock) return;

  const rows = localDb.getAllSync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'pending' AND attempts < ? ORDER BY created_at ASC LIMIT ?`,
    [MAX_ATTEMPTS, BATCH_SIZE],
  );

  for (const row of rows) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      markFailed(row.id, 'JSON parse error');
      continue;
    }

    try {
      let error: { message: string } | null = null;

      if (row.operation === 'insert') {
        ({ error } = await supabase.from(row.table_name).insert(payload));
      } else if (row.operation === 'update') {
        ({ error } = await supabase
          .from(row.table_name)
          .update(payload)
          .eq('id', payload.id));
      } else if (row.operation === 'delete') {
        ({ error } = await supabase
          .from(row.table_name)
          .delete()
          .eq('id', payload.id));
      }

      if (error) {
        markFailed(row.id, error.message);
      } else {
        markSent(row.id);
      }
    } catch (err) {
      markFailed(row.id, String(err));
    }
  }

  // Clean up sent entries older than 24 hours.
  localDb.runSync(
    `DELETE FROM outbox WHERE status = 'sent' AND created_at < ?`,
    [Date.now() - 86_400_000],
  );
}
