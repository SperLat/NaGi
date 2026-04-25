-- Care-team chat: a message thread between intermediaries about a specific
-- elder. Not visible to the elder. Use case: "She seemed confused this
-- morning, anyone called her doctor?" Different from elder_notes (P15) —
-- notes are timestamped events the team writes about the elder; chat is
-- a conversation among the team.

CREATE TABLE elder_team_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES auth.users(id),
  body            text        NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Realtime needs replica identity to deliver row payloads.
ALTER TABLE elder_team_messages REPLICA IDENTITY FULL;

-- Most common query: messages for one elder, newest-first.
CREATE INDEX idx_elder_team_messages_elder_created
  ON elder_team_messages (elder_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE elder_team_messages ENABLE ROW LEVEL SECURITY;

-- Org members read messages for elders in their org.
CREATE POLICY "org members can view team messages"
  ON elder_team_messages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Org members can post; author_id must match the caller.
CREATE POLICY "org members can post team messages"
  ON elder_team_messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- No UPDATE policy: chat history is immutable. No DELETE policy: a chat
-- thread that someone can quietly edit/remove pieces of is no longer
-- trustworthy as a record of what was said.

-- ── SECURITY DEFINER read with author email ─────────────────────────────────
-- Mirrors list_elder_notes (0012) and list_elder_intermediaries (0009).
-- App callers can't read auth.users directly; the RPC joins email
-- server-side and re-checks org membership before returning anything.
CREATE OR REPLACE FUNCTION list_elder_team_messages(elder uuid)
RETURNS TABLE (
  id           uuid,
  body         text,
  created_at   timestamptz,
  author_id    uuid,
  author_email text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM elders e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = elder AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized for this elder';
  END IF;

  RETURN QUERY
    SELECT m.id, m.body, m.created_at, m.author_id, u.email::text
    FROM elder_team_messages m
    JOIN auth.users u ON u.id = m.author_id
    WHERE m.elder_id = elder
    ORDER BY m.created_at DESC
    LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION list_elder_team_messages(uuid) TO authenticated;

-- Resolver for realtime INSERTs. The Realtime payload arrives without
-- the joined email, so we look it up on receipt — but with a single
-- argument so the call cost is one row and one Postgres trip.
CREATE OR REPLACE FUNCTION resolve_team_message_author(message_id uuid)
RETURNS TABLE (author_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
    SELECT u.email::text
    FROM elder_team_messages m
    JOIN auth.users u ON u.id = m.author_id
    JOIN organization_members om
      ON om.organization_id = m.organization_id AND om.user_id = auth.uid()
    WHERE m.id = message_id
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_team_message_author(uuid) TO authenticated;
