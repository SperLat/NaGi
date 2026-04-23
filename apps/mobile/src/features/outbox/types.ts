export type OutboxOp = {
  id: string;            // client-generated UUID (idempotency key sent to server as client_op_id)
  created_at: string;    // ISO timestamp when enqueued
  kind: 'help_request' | 'activity_log';
  payload: unknown;      // typed per kind in the consuming handler
  attempts: number;
  last_error?: string;
};
