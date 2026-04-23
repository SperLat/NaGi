import { readQueue, writeQueue } from './storage';
import { dispatch } from './handlers';
import { MAX_ATTEMPTS } from './backoff';
import type { OutboxOp } from './types';

export async function drainNow(): Promise<{ drained: number; failed: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { drained: 0, failed: 0 };

  let drained = 0;
  let failed = 0;
  const remaining: OutboxOp[] = [];

  // Process oldest-first (queue is FIFO-appended).
  for (const op of queue) {
    if (op.attempts >= MAX_ATTEMPTS) {
      // Already permanently failed — keep in queue for future UI surfacing.
      remaining.push(op);
      failed++;
      continue;
    }

    try {
      await dispatch(op);
      drained++;
      // Drop from queue on success — do NOT push to remaining.
    } catch (err) {
      const updatedOp: OutboxOp = {
        ...op,
        attempts: op.attempts + 1,
        last_error: String(err),
      };

      if (updatedOp.attempts >= MAX_ATTEMPTS) {
        console.warn('[outbox] op failed permanently', updatedOp.id, updatedOp.last_error);
      }

      remaining.push(updatedOp);
      failed++;
    }
  }

  await writeQueue(remaining);
  return { drained, failed };
}
