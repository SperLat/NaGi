-- User profiles: a per-account display name for caregivers.
-- ───────────────────────────────────────────────────────────
-- Today caregivers get attributed via `email.split('@')[0]` everywhere
-- they appear (care-circle authorship, digest help-request handlers,
-- preparedBy on the kiosk). That works for one Emma in one family but
-- gets clinical fast: c4rlos.gomez1996, lucy+work@gmail.com, etc.
-- The elder already has a `preferred_name` for warmth; the intermediary
-- deserves the same affordance.
--
-- Scope:
--   - One display_name per user, global across orgs.
--   - Multi-org-different-name is a future evolution if real demand
--     surfaces; not worth the friction at MVP.
--   - Read-by-anyone-authenticated so any care-circle resolver can
--     look up author names. Update only by the owner.
--
-- Auth posture: caregivers can choose to leave display_name unset.
-- Surfaces fall through to email-split as before. Adding a name is
-- opt-in warmth, not a forced field.

CREATE TABLE user_profiles (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 80),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles REPLICA IDENTITY FULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user. The point of this table is to resolve
-- names that appear in shared surfaces (care-circle, digest narrative).
-- The data is just a chosen display name, not contact info.
CREATE POLICY "authenticated can read user profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Insert / update: only the owner. RLS prevents one user from setting
-- another user's display name even if a client tried.
CREATE POLICY "users can write their own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can delete their own profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── Helper: resolve display name with email-split fallback ────────────
-- The care-circle, digest, and kiosk attribution all need the same
-- "show the user's chosen name, or fall back to email handle" logic.
-- Centralize it as a SQL function so the fallback rule stays one place.
CREATE OR REPLACE FUNCTION resolve_user_display_name(target_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    NULLIF(trim(p.display_name), ''),
    split_part(u.email, '@', 1),
    'someone'
  )
    FROM auth.users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
   WHERE u.id = target_user_id
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION resolve_user_display_name(uuid) TO authenticated;

-- ── Update care-circle RPCs to return display_name alongside email ──
-- The care-circle author badge wants the chosen display_name when set,
-- email-handle fallback otherwise. Centralize that COALESCE in the RPC
-- so the client always gets a render-ready string. Same shape applied
-- to the realtime resolver so the live patch path stays consistent.

DROP FUNCTION IF EXISTS list_elder_team_messages(uuid);

CREATE OR REPLACE FUNCTION list_elder_team_messages(elder uuid)
RETURNS TABLE (
  id                  uuid,
  body                text,
  audio_path          text,
  created_at          timestamptz,
  author_id           uuid,
  author_email        text,
  author_display_name text
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
    SELECT
      m.id, m.body, m.audio_path, m.created_at, m.author_id,
      u.email::text,
      COALESCE(NULLIF(trim(p.display_name), ''), split_part(u.email::text, '@', 1)) AS author_display_name
    FROM elder_team_messages m
    JOIN auth.users u ON u.id = m.author_id
    LEFT JOIN user_profiles p ON p.user_id = m.author_id
    WHERE m.elder_id = elder
    ORDER BY m.created_at DESC
    LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION list_elder_team_messages(uuid) TO authenticated;

-- Realtime resolver: same join, returns just display_name now (clients
-- already have email from the cold list; the live INSERT just needs
-- the render-ready name).
DROP FUNCTION IF EXISTS resolve_team_message_author(uuid);

CREATE OR REPLACE FUNCTION resolve_team_message_author(message_id uuid)
RETURNS TABLE (author_email text, author_display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
    SELECT
      u.email::text,
      COALESCE(NULLIF(trim(p.display_name), ''), split_part(u.email::text, '@', 1))
    FROM elder_team_messages m
    JOIN auth.users u ON u.id = m.author_id
    LEFT JOIN user_profiles p ON p.user_id = m.author_id
    WHERE m.id = message_id
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_team_message_author(uuid) TO authenticated;
