/**
 * Handler registry — one async function per OutboxOp.kind.
 *
 * Each handler receives the full op and must:
 *   - Perform the server write (upsert with client_op_id for idempotency).
 *   - Throw on failure so the drain loop can record attempts + last_error.
 *   - Return void on success.
 */
import { supabase } from '@/lib/supabase';
import type { OutboxOp } from './types';

// ── help_request ──────────────────────────────────────────────────────────────

interface HelpRequestPayload {
  elder_id: string;
  organization_id: string;
}

async function handleHelpRequest(op: OutboxOp): Promise<void> {
  const payload = op.payload as HelpRequestPayload;
  const { error } = await supabase
    .from('help_requests')
    .upsert(
      { ...payload, client_op_id: op.id },
      { onConflict: 'client_op_id', ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

// ── activity_log ──────────────────────────────────────────────────────────────

interface ActivityLogPayload {
  id: string;
  elder_id: string;
  organization_id: string;
  kind: string;
  payload: Record<string, unknown>;
  client_ts: string;
  device_id: string;
}

async function handleActivityLog(op: OutboxOp): Promise<void> {
  const payload = op.payload as ActivityLogPayload;
  const { error } = await supabase
    .from('activity_log')
    .upsert(
      { ...payload, client_op_id: op.id },
      { onConflict: 'client_op_id', ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export async function dispatch(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case 'help_request':
      return handleHelpRequest(op);
    case 'activity_log':
      return handleActivityLog(op);
    default: {
      // Exhaustiveness guard — TypeScript will error if a new kind is added
      // to OutboxOp without a handler.
      const _exhaustive: never = op.kind;
      throw new Error(`[outbox] unknown op kind: ${String(_exhaustive)}`);
    }
  }
}
