-- Packet 4: explicit invitation acceptance for elder_intermediaries.
--
-- Under packet 3, add_elder_intermediary silently joined the invitee to the
-- elder's organization. Two problems with that:
--
--   1. No consent — the invitee never agreed to take on the relationship.
--   2. Silent org switching — invitees who already had their own family org
--      ended up with two memberships, and getActiveOrg picked one arbitrarily,
--      so they could log in to an empty dashboard with no hint an invitation
--      was waiting.
--
-- Fix: an explicit pending → accept flow. The elder_intermediaries row IS the
-- relationship; an `accepted_at` timestamp promotes it from offer to active.
-- Org-membership is granted at the moment of accept, not at the moment of
-- invite.
--
-- Existing rows are backfilled as already-accepted (accepted_at = created_at)
-- so we don't break anyone mid-flight.

ALTER TABLE elder_intermediaries
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

UPDATE elder_intermediaries
   SET accepted_at = created_at
 WHERE accepted_at IS NULL;

-- ── add_elder_intermediary ────────────────────────────────────────────────
-- Same signature as 0009, but no longer auto-joins the invitee to the org.
-- Just creates a pending elder_intermediaries row (accepted_at = NULL).
-- On conflict we update the relation only — never overwrite a prior
-- acceptance, so re-inviting an already-accepted person is a no-op for
-- their accepted_at timestamp.

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
  -- NOTE: deliberately do NOT touch accepted_at on conflict — preserves any
  -- prior acceptance if the inviter re-invites with an updated relation.

  RETURN target_user_id;
END;
$$;

-- ── list_elder_intermediaries ─────────────────────────────────────────────
-- Adds accepted_at so the inviter UI can render a "Pending" pill.
-- Postgres rejects CREATE OR REPLACE when the return type (RETURNS TABLE)
-- changes, so drop the 0009 version first.

DROP FUNCTION IF EXISTS list_elder_intermediaries(uuid);

CREATE OR REPLACE FUNCTION list_elder_intermediaries(elder uuid)
RETURNS TABLE (
  user_id     uuid,
  email       text,
  relation    text,
  created_at  timestamptz,
  accepted_at timestamptz
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
    SELECT ei.user_id, u.email::text, ei.relation, ei.created_at, ei.accepted_at
    FROM elder_intermediaries ei
    JOIN auth.users u ON u.id = ei.user_id
    WHERE ei.elder_id = elder
    ORDER BY ei.created_at ASC;
END;
$$;

-- ── accept_elder_intermediary ─────────────────────────────────────────────
-- Caller is the invitee. Promotes their pending row, then grants org
-- membership. SECURITY DEFINER because the invitee may not yet be a
-- member of the elder's org and so cannot insert into organization_members
-- under their own RLS.

CREATE OR REPLACE FUNCTION accept_elder_intermediary(elder uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_org uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM elder_intermediaries
    WHERE elder_id = elder
      AND user_id  = auth.uid()
      AND accepted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'no pending invitation';
  END IF;

  UPDATE elder_intermediaries
     SET accepted_at = now()
   WHERE elder_id = elder
     AND user_id  = auth.uid()
     AND accepted_at IS NULL;

  SELECT organization_id INTO target_org
  FROM elders
  WHERE id = elder;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (target_org, auth.uid(), 'intermediary')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

-- ── decline_elder_intermediary ────────────────────────────────────────────
-- Caller is the invitee. Deletes the pending row. Does NOT touch
-- organization_members (we never added them at invite time).

CREATE OR REPLACE FUNCTION decline_elder_intermediary(elder uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM elder_intermediaries
   WHERE elder_id = elder
     AND user_id  = auth.uid()
     AND accepted_at IS NULL;
END;
$$;

-- ── list_my_pending_invitations ───────────────────────────────────────────
-- Dashboard query for the invitee. There is no `invited_by` column on
-- elder_intermediaries (we deliberately did not add one — it would be
-- invasive for a hackathon scope). Approximate the inviter as the earliest
-- 'owner' of the elder's organization. Good enough for the demo.

CREATE OR REPLACE FUNCTION list_my_pending_invitations()
RETURNS TABLE (
  elder_id      uuid,
  elder_name    text,
  org_name      text,
  inviter_email text,
  relation      text,
  created_at    timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT
      e.id                  AS elder_id,
      e.display_name        AS elder_name,
      o.name                AS org_name,
      (
        SELECT u.email::text
        FROM organization_members om
        JOIN auth.users u ON u.id = om.user_id
        WHERE om.organization_id = e.organization_id
          AND om.role = 'owner'
        ORDER BY om.created_at ASC
        LIMIT 1
      )                     AS inviter_email,
      ei.relation,
      ei.created_at
    FROM elder_intermediaries ei
    JOIN elders        e ON e.id = ei.elder_id
    JOIN organizations o ON o.id = e.organization_id
    WHERE ei.user_id = auth.uid()
      AND ei.accepted_at IS NULL
    ORDER BY ei.created_at ASC;
END;
$$;
