// Outbox enqueue — Step 6 implements the drain engine.
import { isMock } from '@/config/mode';
import { localDb } from '@/lib/db';

export function enqueueOutbox(
  tableName: string,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>,
): void {
  if (isMock) return;
  const id = crypto.randomUUID();
  localDb.runSync(
    'INSERT INTO outbox (id, table_name, operation, payload, created_at, status) VALUES (?, ?, ?, ?, ?, ?)',
    [id, tableName, operation, JSON.stringify(payload), Date.now(), 'pending'],
  );
}
