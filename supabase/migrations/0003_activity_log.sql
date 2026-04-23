-- Append-only log of elder-side events, synced from device
CREATE TABLE activity_log (
  id              uuid        PRIMARY KEY,
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            text        NOT NULL CHECK (kind IN ('ai_turn', 'ui_action', 'error', 'offline_ai_unavailable')),
  payload         jsonb       NOT NULL,
  client_ts       timestamptz NOT NULL,
  server_ts       timestamptz NOT NULL DEFAULT now(),
  device_id       text        NOT NULL
);

CREATE INDEX activity_log_elder_ts_idx ON activity_log (elder_id, server_ts DESC);
CREATE INDEX activity_log_org_ts_idx   ON activity_log (organization_id, server_ts DESC);
