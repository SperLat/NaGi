-- Elder notes: shared timestamped journal between intermediaries about
-- a specific elder. Different shape from elders.profile (which is static
-- "how she works"); notes are events ("Tuesday — doctor visit went well").
-- Not visible to the elder. Use case: keep the care team aligned on what
-- happened this week, who said what to the doctor, etc.

CREATE TABLE elder_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES auth.users(id),
  body            text        NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  -- occurred_at is the time the *event* happened (caregiver may backdate).
  -- created_at is when the note was written. Both default to now() so the
  -- common case ("note about right now") needs neither field set.
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Most common query: notes for an elder, newest first.
CREATE INDEX idx_elder_notes_elder_occurred ON elder_notes (elder_id, occurred_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE elder_notes ENABLE ROW LEVEL SECURITY;

-- Any org member can read notes for elders in their org.
CREATE POLICY "org members can view elder notes"
  ON elder_notes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Any org member can post a note. The author_id must match the caller —
-- the WITH CHECK ensures we can't impersonate another caregiver.
CREATE POLICY "org members can post elder notes"
  ON elder_notes FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Only the author can delete their own note. No UPDATE policy on purpose:
-- notes are an audit trail of what someone said at a moment in time —
-- editing them would erode that trust. If you got something wrong, post
-- a follow-up note.
CREATE POLICY "authors can delete their own notes"
  ON elder_notes FOR DELETE
  USING (author_id = auth.uid());

-- ── SECURITY DEFINER read with author email ─────────────────────────────────
-- Mirrors the list_elder_intermediaries pattern (0009): app callers can't
-- join auth.users directly, so the RPC does it server-side and re-checks
-- org membership before returning anything.
CREATE OR REPLACE FUNCTION list_elder_notes(elder uuid)
RETURNS TABLE (
  id           uuid,
  body         text,
  occurred_at  timestamptz,
  created_at   timestamptz,
  author_id    uuid,
  author_email text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Defense in depth: even though RLS would block the underlying SELECT,
  -- raise explicitly so callers get a clear error rather than empty data.
  IF NOT EXISTS (
    SELECT 1 FROM elders e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = elder AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized for this elder';
  END IF;

  RETURN QUERY
    SELECT n.id, n.body, n.occurred_at, n.created_at, n.author_id, u.email::text
    FROM elder_notes n
    JOIN auth.users u ON u.id = n.author_id
    WHERE n.elder_id = elder
    ORDER BY n.occurred_at DESC
    LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION list_elder_notes(uuid) TO authenticated;
