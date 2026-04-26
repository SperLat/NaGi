-- Voice notes in the care-circle (formerly "team chat"). Caregivers
-- coordinating about an elder can leave a quick spoken note instead
-- of typing — useful when hands are full or speech is faster than
-- thumbs.
--
-- Translation is intentionally NOT in this path. The team-circle is
-- intra-org (everyone speaks the family's language); the cross-tenant
-- elder-to-elder messaging is the surface that needs translation. No
-- Whisper transcription either — team voice notes are heard, not read.
-- If a team member wants to summarize, they can post a text reply.
--
-- Note: the underlying table is still named elder_team_messages from
-- migration 0011. The user-facing label was renamed to "Care circle"
-- but the schema name stays for stability. Renaming a live table just
-- to mirror a UI label is migration risk for no user benefit.

-- ── Schema additions ────────────────────────────────────────────────
ALTER TABLE elder_team_messages
  ADD COLUMN audio_path text;

COMMENT ON COLUMN elder_team_messages.audio_path IS
  'Storage key in the team-voice-notes bucket for voice messages. NULL '
  'for text-only messages. The send-team-voice-note edge function uploads '
  'under <elder_id>/<message_id>.<ext> with service_role.';

-- The body CHECK constraint requires length 1-4000 — preserve that for
-- text-only messages but allow voice-only via a placeholder body.
-- We don't relax the constraint because empty body in the text path
-- is genuinely a bug; we just let the function set body='🎙️' for
-- voice-only inserts. Keeps invariant clean.

-- ── Storage bucket for team voice notes ────────────────────────────
-- Private; clients never upload directly. The send-team-voice-note
-- edge function holds service_role and uploads after verifying org
-- membership. Reads go through team-voice-note-url (a follow-up
-- function), same shape as elder-voice-messages.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('team-voice-notes', 'team-voice-notes', false)
  ON CONFLICT (id) DO NOTHING;

-- ── Replace list RPC to include audio_path ─────────────────────────
-- DROP first because CREATE OR REPLACE refuses to change the return
-- type (TABLE shape) of an existing function — Postgres treats that
-- as a breaking signature change. Same function body, just one extra
-- column in the row type.
DROP FUNCTION IF EXISTS list_elder_team_messages(uuid);

CREATE OR REPLACE FUNCTION list_elder_team_messages(elder uuid)
RETURNS TABLE (
  id           uuid,
  body         text,
  audio_path   text,
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
    SELECT m.id, m.body, m.audio_path, m.created_at, m.author_id, u.email::text
    FROM elder_team_messages m
    JOIN auth.users u ON u.id = m.author_id
    WHERE m.elder_id = elder
    ORDER BY m.created_at DESC
    LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION list_elder_team_messages(uuid) TO authenticated;
