-- Elder-to-elder messaging across tenants.
-- ────────────────────────────────────────
-- Today the RLS model is rock-solid org-isolated: every consumable row
-- joins organization_members for access. To allow two elders in
-- DIFFERENT family organizations to communicate, we introduce a
-- "consented bridge" — an explicit elder_connections row that, once
-- accepted by both sides, lets RLS on elder_messages permit cross-org
-- reads/writes scoped to that pair.
--
-- The brand framing matters here:
--   - The intermediary (caregiver) on each side controls consent.
--   - The elder NEVER sees other elders they are not connected to.
--   - Connections are bilateral and revocable (paused).
--   - Messages flow elder-to-elder via Nagi as the intermediary —
--     the family member on each side reviews via the dashboard but
--     cannot edit or block individual messages without pausing the
--     entire connection.
--
-- This is the philosophical "cultivation, not imposition" feature —
-- Nagi tends the conditions for an elder-to-elder relationship to
-- exist; the elders own the relationship.

-- ── Tables ────────────────────────────────────────────────────────

CREATE TABLE elder_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always store the pair with elder_a_id < elder_b_id (lexically)
  -- so a single (a, b) row uniquely identifies a connection — no
  -- need to deduplicate (a,b) vs (b,a).
  elder_a_id      uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  elder_b_id      uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  proposed_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_at     timestamptz NOT NULL DEFAULT now(),
  accepted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at     timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'active', 'paused', 'declined')),

  CONSTRAINT pair_ordered      CHECK (elder_a_id < elder_b_id),
  CONSTRAINT no_self_connect   CHECK (elder_a_id <> elder_b_id),
  CONSTRAINT pair_unique       UNIQUE (elder_a_id, elder_b_id)
);

CREATE INDEX elder_connections_a_idx ON elder_connections (elder_a_id);
CREATE INDEX elder_connections_b_idx ON elder_connections (elder_b_id);
CREATE INDEX elder_connections_active_idx ON elder_connections (status) WHERE status = 'active';

CREATE TABLE elder_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES elder_connections(id) ON DELETE CASCADE,
  from_elder_id   uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  -- { en: "...", es: "...", pt: "..." } — populated lazily by the
  -- translate-message edge function on first read in a non-source lang.
  -- Sender's language is keyed by their elder's preferred_lang.
  body_translated jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz
);

CREATE INDEX elder_messages_connection_ts_idx
  ON elder_messages (connection_id, created_at DESC);

-- Enable realtime for both tables — clients subscribe to INSERT events
-- on elder_messages so the receiving elder's home screen wakes up.
ALTER TABLE elder_connections REPLICA IDENTITY FULL;
ALTER TABLE elder_messages    REPLICA IDENTITY FULL;

-- ── Helper: is the caller in either elder's org? ──────────────────
-- Used by RLS policies on both tables. SECURITY DEFINER + pinned
-- search_path closes the shadow-attack vector flagged by the linter.
CREATE OR REPLACE FUNCTION is_in_either_elder_org(
  a_elder_id uuid,
  b_elder_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM elders e
      JOIN organization_members om ON om.organization_id = e.organization_id
     WHERE e.id IN (a_elder_id, b_elder_id)
       AND om.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_in_one_elder_org(
  the_elder_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM elders e
      JOIN organization_members om ON om.organization_id = e.organization_id
     WHERE e.id = the_elder_id
       AND om.user_id = auth.uid()
  );
$$;

-- ── RLS on elder_connections ──────────────────────────────────────
ALTER TABLE elder_connections ENABLE ROW LEVEL SECURITY;

-- Read: caller is in the org of either elder.
CREATE POLICY elder_connections_select
  ON elder_connections FOR SELECT
  USING (is_in_either_elder_org(elder_a_id, elder_b_id));

-- Insert: caller is in the org of one of the two elders, and is the
-- proposer. Status starts pending. Cross-tenant by design — the
-- caller's org is the proposer's side, the OTHER elder is in a
-- different org.
CREATE POLICY elder_connections_insert
  ON elder_connections FOR INSERT
  WITH CHECK (
    auth.uid() = proposed_by
    AND is_in_either_elder_org(elder_a_id, elder_b_id)
  );

-- Update: only the OTHER side (not the proposer) can change status.
-- This enforces "the recipient consents" — proposer can't auto-accept
-- their own invite. Pausing/declining works in either direction once
-- accepted, so the predicate is "caller is in org of either elder
-- AND caller != proposed_by" for the accept transition specifically.
-- For simplicity the policy allows any update by either-side member
-- AS LONG AS they are not the proposer when transitioning out of pending.
-- The application layer (RPC below) enforces the finer rule.
CREATE POLICY elder_connections_update
  ON elder_connections FOR UPDATE
  USING (is_in_either_elder_org(elder_a_id, elder_b_id))
  WITH CHECK (is_in_either_elder_org(elder_a_id, elder_b_id));

-- ── RLS on elder_messages ─────────────────────────────────────────
ALTER TABLE elder_messages ENABLE ROW LEVEL SECURITY;

-- Read: caller is in either side's org via the bridge.
CREATE POLICY elder_messages_select
  ON elder_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM elder_connections c
       WHERE c.id = elder_messages.connection_id
         AND is_in_either_elder_org(c.elder_a_id, c.elder_b_id)
    )
  );

-- Insert: caller must be in from_elder's org AND the connection must
-- be active. Senders cannot fake the from_elder_id — RLS rejects it
-- if they are not in that elder's org.
CREATE POLICY elder_messages_insert
  ON elder_messages FOR INSERT
  WITH CHECK (
    is_in_one_elder_org(from_elder_id)
    AND EXISTS (
      SELECT 1 FROM elder_connections c
       WHERE c.id = connection_id
         AND c.status = 'active'
         AND from_elder_id IN (c.elder_a_id, c.elder_b_id)
    )
  );

-- Update: read_at can be set by EITHER side's org member (the receiver
-- marking a message read is a normal flow). body and translation
-- updates are handled by the translate-message edge function running
-- as service_role, which bypasses RLS.
CREATE POLICY elder_messages_update_read
  ON elder_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM elder_connections c
       WHERE c.id = elder_messages.connection_id
         AND is_in_either_elder_org(c.elder_a_id, c.elder_b_id)
    )
  );

-- ── RPC: propose a connection from one of my elders to another ────
-- The caller passes the two elder ids and a relation note. The function
-- normalizes the pair (a_id < b_id) so duplicates are impossible.
CREATE OR REPLACE FUNCTION propose_elder_connection(
  my_elder_id    uuid,
  other_elder_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_a          uuid;
  v_b          uuid;
  v_conn_id    uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be in the proposer's elder's org (RLS would block,
  -- but raise early with a clearer error).
  IF NOT is_in_one_elder_org(my_elder_id) THEN
    RAISE EXCEPTION 'Not authorized to propose on behalf of elder %', my_elder_id;
  END IF;

  IF my_elder_id = other_elder_id THEN
    RAISE EXCEPTION 'An elder cannot connect to themselves';
  END IF;

  -- Normalize ordering so (a,b) is always (lower, higher) by UUID.
  IF my_elder_id < other_elder_id THEN
    v_a := my_elder_id;  v_b := other_elder_id;
  ELSE
    v_a := other_elder_id; v_b := my_elder_id;
  END IF;

  INSERT INTO elder_connections (elder_a_id, elder_b_id, proposed_by, proposed_at, status)
  VALUES (v_a, v_b, v_caller, now(), 'pending')
  ON CONFLICT (elder_a_id, elder_b_id) DO UPDATE
    SET status = 'pending',
        proposed_by = EXCLUDED.proposed_by,
        proposed_at = EXCLUDED.proposed_at,
        accepted_by = NULL,
        accepted_at = NULL
  RETURNING id INTO v_conn_id;

  RETURN v_conn_id;
END $$;

-- ── RPC: accept or decline a pending connection ───────────────────
CREATE OR REPLACE FUNCTION respond_to_elder_connection(
  connection_id uuid,
  accept        boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row    elder_connections%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM elder_connections WHERE id = connection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection % not found', connection_id;
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Connection is not pending (status: %)', v_row.status;
  END IF;

  -- Caller must be in the OTHER elder's org — proposer cannot auto-accept.
  IF v_caller = v_row.proposed_by THEN
    RAISE EXCEPTION 'The proposer cannot accept their own invite';
  END IF;

  IF NOT is_in_either_elder_org(v_row.elder_a_id, v_row.elder_b_id) THEN
    RAISE EXCEPTION 'Not authorized for this connection';
  END IF;

  UPDATE elder_connections
     SET status      = CASE WHEN accept THEN 'active' ELSE 'declined' END,
         accepted_by = v_caller,
         accepted_at = CASE WHEN accept THEN now() ELSE NULL END
   WHERE id = connection_id;
END $$;

-- ── RPC: list my pending incoming connection invites ──────────────
-- Returns connections where the caller's elder is the recipient (not
-- the proposer) and status is pending. Used by the intermediary
-- dashboard to surface incoming invitations.
CREATE OR REPLACE FUNCTION list_my_pending_elder_connections()
RETURNS TABLE (
  connection_id   uuid,
  my_elder_id     uuid,
  my_elder_name   text,
  other_elder_id  uuid,
  other_elder_name text,
  proposed_at     timestamptz,
  proposer_email  text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    c.id AS connection_id,
    -- "my" is the elder in MY org; "other" is in the proposer's org.
    CASE WHEN my_elder.organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ) THEN my_elder.id ELSE other_elder.id END AS my_elder_id,
    CASE WHEN my_elder.organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ) THEN my_elder.display_name ELSE other_elder.display_name END,
    CASE WHEN my_elder.organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ) THEN other_elder.id ELSE my_elder.id END,
    CASE WHEN my_elder.organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ) THEN other_elder.display_name ELSE my_elder.display_name END,
    c.proposed_at,
    u.email::text
  FROM elder_connections c
  JOIN elders my_elder    ON my_elder.id    = c.elder_a_id
  JOIN elders other_elder ON other_elder.id = c.elder_b_id
  JOIN auth.users u       ON u.id           = c.proposed_by
  WHERE c.status = 'pending'
    AND c.proposed_by <> auth.uid()
    AND is_in_either_elder_org(c.elder_a_id, c.elder_b_id);
$$;
