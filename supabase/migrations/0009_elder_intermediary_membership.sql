-- Packet 3: membership management for elder_intermediaries.
--
-- The anon-keyed client cannot read auth.users, so we expose two narrow
-- SECURITY DEFINER RPCs:
--
--   list_elder_intermediaries(elder)  — returns {user_id, email, relation, created_at}
--                                       for each intermediary of the elder.
--   add_elder_intermediary(elder, email, relation)
--                                     — looks up the user by email and inserts
--                                       the row. Returns the inserted user_id,
--                                       or NULL when no user has that email
--                                       (caller shows "not joined yet" UX).
--
-- Both functions enforce that the caller is a member of the elder's org —
-- this mirrors the existing RLS on elder_intermediaries without leaking
-- auth.users to the client.

CREATE OR REPLACE FUNCTION list_elder_intermediaries(elder uuid)
RETURNS TABLE (
  user_id    uuid,
  email      text,
  relation   text,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM elders e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = elder AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT ei.user_id, u.email::text, ei.relation, ei.created_at
    FROM elder_intermediaries ei
    JOIN auth.users u ON u.id = ei.user_id
    WHERE ei.elder_id = elder
    ORDER BY ei.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION add_elder_intermediary(
  elder    uuid,
  email    text,
  relation text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM elders e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = elder AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT u.id INTO target_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(add_elder_intermediary.email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO elder_intermediaries (elder_id, user_id, relation)
  VALUES (elder, target_user_id, relation)
  ON CONFLICT (elder_id, user_id) DO UPDATE
    SET relation = EXCLUDED.relation;

  -- Also add the invitee to the elder's organization so RLS-protected
  -- reads (help_requests, activity_log, elders, ai_interactions) work.
  -- Without this, the invitee would appear in the "circle" but couldn't
  -- actually see the elder or receive help alerts.
  INSERT INTO organization_members (organization_id, user_id, role)
  SELECT e.organization_id, target_user_id, 'intermediary'
  FROM elders e
  WHERE e.id = elder
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN target_user_id;
END;
$$;
