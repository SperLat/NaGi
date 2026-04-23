/**
 * Nagi Outbox — generic offline-safe write queue
 *
 * SAFETY INVARIANT (help-request path):
 *   An elder who taps "Necesito Ayuda" MUST see a calm success response
 *   immediately, even with zero connectivity. `enqueue()` always resolves
 *   synchronously from the caller's perspective. The op is persisted to
 *   AsyncStorage and drained to the server whenever connectivity returns.
 *   The intermediary dashboard receives the row via Supabase Realtime once
 *   the drain succeeds — which may be seconds or minutes later. No "queued"
 *   or "pending" state is ever surfaced to the elder.
 *
 * IDEMPOTENCY:
 *   Every op carries a client-generated UUID (`id`). The server tables have
 *   a `client_op_id uuid UNIQUE` column (see migration 0008). Draining uses
 *   upsert with `onConflict: 'client_op_id'` so replaying the same op never
 *   creates duplicates.
 */

export type { OutboxOp } from './types';
export { enqueue } from './enqueue';
export { drainNow } from './drain';
export { startAutoDrain } from './auto-drain';
