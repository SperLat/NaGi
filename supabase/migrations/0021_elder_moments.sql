-- Elder moments — the Kasvu growth thread.
-- ─────────────────────────────────────────
-- Today the platform is reactive: Nagi waits for the elder to talk.
-- This table makes growth visible: a small log of things the elder did,
-- noticed, or shared this week — surfaced into the family digest and a
-- monthly "proud moments" summary.
--
-- Three sources, all valid:
--   - 'nagi'      — Nagi noticed during a chat (the most common path,
--                   triggered by the proud-moments home tile or by
--                   organic conversation that surfaced a moment).
--   - 'caregiver' — family logged on behalf of the elder.
--   - 'elder'     — direct elder entry (reserved for future paths;
--                   today the kiosk has no auth user for the elder, so
--                   moments from the kiosk arrive as 'nagi').
--
-- Brand stance, engineered into the schema:
--   - is_private mirrors the elder's existing privacy boundary on chat
--     turns. Family-facing surfaces show "a private moment" placeholder
--     when is_private=true; substance is never sent to the digest LLM.
--   - No "missed" or "low" or "deficit" fields. The schema has no place
--     to store negative framing — by design.
--   - occurred_on is a date, not a timestamp: the moment happened on a
--     day, not at a precise instant. Caregivers can backdate.

CREATE TABLE elder_moments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  occurred_on     date        NOT NULL DEFAULT CURRENT_DATE,
  -- Optional tag to color the digest. Free text rather than enum so the
  -- model can pick a sensible word ('walk', 'visita', 'leitura') without
  -- a server-side enum check tripping on locale variants.
  kind            text                 CHECK (kind IS NULL OR length(kind) <= 60),
  body            text        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  is_private      boolean     NOT NULL DEFAULT false,
  source          text        NOT NULL DEFAULT 'caregiver'
                              CHECK (source IN ('elder', 'caregiver', 'nagi')),
  -- Null when source='nagi' (no auth user; the edge function inserts).
  -- Set when source='caregiver' (the family member writing).
  created_by      uuid                 REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX elder_moments_elder_when_idx
  ON elder_moments (elder_id, occurred_on DESC);

CREATE INDEX elder_moments_elder_public_idx
  ON elder_moments (elder_id, is_private, occurred_on DESC);

ALTER TABLE elder_moments REPLICA IDENTITY FULL;

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE elder_moments ENABLE ROW LEVEL SECURITY;

-- Read: any org member sees moments for elders in their org. Private
-- moments are still readable by the org (the family is trusted with
-- the elder's data) — the *digest LLM* never sees private substance,
-- but a caregiver reading the moments list does, so they can spot a
-- moment that should be edited or marked private.
--
-- The family-facing aggregate views (digest, monthly summary) filter
-- is_private=false in their queries.
CREATE POLICY "org members can view elder moments"
  ON elder_moments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Write: caregivers writing on behalf of the elder. The 'nagi' source
-- path is exercised by the edge function running as service_role, which
-- bypasses RLS — same pattern as ai_interactions and the elder_messages
-- translation path.
CREATE POLICY "org members can write elder moments"
  ON elder_moments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    AND (
      -- Caregiver source: created_by must match caller.
      (source = 'caregiver' AND created_by = auth.uid())
      OR
      -- Direct elder source (future use): created_by is null.
      (source = 'elder' AND created_by IS NULL)
    )
    -- 'nagi' source is rejected by RLS — only service_role can write
    -- those. This stops a caregiver from spoofing an "AI-noticed" moment.
  );

CREATE POLICY "org members can update elder moments"
  ON elder_moments FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Delete: only the original author of caregiver-logged moments (same
-- discipline as elder_notes: no edit history, but you can delete what
-- you wrote). Nagi-logged moments can only be deleted by the family
-- via the moments review screen, which uses an UPDATE setting
-- is_private=true rather than DELETE; we keep them for the record.
CREATE POLICY "authors can delete their caregiver moments"
  ON elder_moments FOR DELETE
  USING (
    source = 'caregiver'
    AND created_by = auth.uid()
  );
