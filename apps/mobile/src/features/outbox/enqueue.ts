import type { OutboxOp } from './types';
import { readQueue, writeQueue } from './storage';

export async function enqueue(
  op: Omit<OutboxOp, 'id' | 'created_at' | 'attempts'> & { id?: string },
): Promise<OutboxOp> {
  const full: OutboxOp = {
    id: op.id ?? crypto.randomUUID(),
    created_at: new Date().toISOString(),
    kind: op.kind,
    payload: op.payload,
    attempts: 0,
  };

  const queue = await readQueue();
  queue.push(full);
  await writeQueue(queue);

  return full;
}
