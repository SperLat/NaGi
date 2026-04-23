-- Outbox idempotency: add client_op_id to tables that receive offline writes.
--
-- client_op_id is the UUID the mobile client generates when enqueuing an op.
-- The drain engine uses upsert with onConflict: 'client_op_id' so replaying
-- the same op (e.g. after a crash between drain success and AsyncStorage write)
-- never creates duplicate rows.
--
-- Added as nullable columns so existing rows are unaffected and the migration
-- is safe to run on a live database.

ALTER TABLE help_requests
  ADD COLUMN IF NOT EXISTS client_op_id uuid,
  ADD CONSTRAINT help_requests_client_op_id_unique UNIQUE (client_op_id);

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS client_op_id uuid,
  ADD CONSTRAINT activity_log_client_op_id_unique UNIQUE (client_op_id);
