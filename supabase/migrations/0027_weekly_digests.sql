-- Weekly digests — persistence for the family-facing weekly narrative.
-- ────────────────────────────────────────────────────────────────────
-- v1 of generate-digest was stateless: every click hit Claude, returned
-- markdown, and nothing was saved. That makes for a clean architecture
-- but two real misses:
--   - Caregivers who want to compare last week to two weeks ago can't.
--   - Judges browsing a demo dashboard see no history — every digest
--     looks like a one-off from this single moment.
--
-- Storing the markdown costs ~1-3 KB per row per elder per week. Cheap.
-- We keep stats_json so the family-facing footer can render counts
-- without re-running aggregation.
--
-- Brand stance: stats_json captures what was true at generation time,
-- including any private substance the digest LLM was blind to. The
-- family-readable markdown is what judgment was made on; the stats are
-- the receipt.

CREATE TABLE weekly_digests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  -- Inclusive period covered. period_end is the moment of generation;
  -- period_start is exactly 7 days earlier in the canonical implementation.
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  digest_markdown text        NOT NULL CHECK (length(digest_markdown) BETWEEN 1 AND 8000),
  stats_json      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Most common query: list per elder, newest first, for the archive
-- panel on the elder profile page.
CREATE INDEX weekly_digests_elder_created_idx
  ON weekly_digests (elder_id, created_at DESC);

ALTER TABLE weekly_digests REPLICA IDENTITY FULL;

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

-- Read: any org member can read their org's digests.
CREATE POLICY "org members can view weekly digests"
  ON weekly_digests FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Insert: through the edge function under service_role. Direct client
-- inserts are blocked by the absence of a client INSERT policy. This
-- keeps the digest generation path the only way rows land here, which
-- is what we want — caregivers don't write digests by hand.

-- Delete: org members can delete a digest they no longer want surfaced
-- (the elder asked to remove a sensitive one, e.g.). The edge function
-- never deletes; only humans do.
CREATE POLICY "org members can delete weekly digests"
  ON weekly_digests FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
