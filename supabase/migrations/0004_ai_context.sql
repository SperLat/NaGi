-- AI interaction audit log (token usage, cache observability, error tracking)
CREATE TABLE ai_interactions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id            uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model               text        NOT NULL,
  profile_version     int         NOT NULL,
  input_tokens        int,
  output_tokens       int,
  cache_read_tokens   int,
  cache_write_tokens  int,
  latency_ms          int,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_interactions_elder_idx ON ai_interactions (elder_id, created_at DESC);
