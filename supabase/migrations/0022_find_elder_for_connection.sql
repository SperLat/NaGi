-- Cross-tenant elder search for the "Friends across families" proposal flow.
-- ──────────────────────────────────────────────────────────────────────────
-- The client's existing findElderByName ran a plain SELECT through the
-- caller's RLS, which only sees elders in the caller's own orgs. That made
-- cross-tenant proposals impossible to discover — the whole point of the
-- "Friends across families" feature. The previous empty-state copy
-- ("No elder by that name visible to you. You can only propose to elders
-- whose families have signed up.") was misleading: it blamed signup
-- status when the real cause was RLS scoping.
--
-- This RPC bypasses RLS deliberately, with a tighter contract than the
-- raw table:
--   - Authenticated callers only.
--   - Minimum query length of 3 chars to discourage enumeration.
--   - Caller's own org elders excluded — they're already visible via RLS,
--     and cross-tenant search is the only purpose of this surface.
--   - Returns only the four fields needed to disambiguate and propose
--     (id, display_name, preferred_lang, organization_name). No contact
--     data, no profile substance, no status fields.
--   - Result count capped at 10 — search refines, doesn't browse.
--
-- Privacy floor: the recipient family still has to accept the proposal
-- before any data flows. Discovery surface is just enough to identify
-- and propose. Same pattern as propose_elder_connection in 0019.

CREATE OR REPLACE FUNCTION find_elder_for_connection(query text)
RETURNS TABLE (
  id                 uuid,
  display_name       text,
  preferred_lang     text,
  organization_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_q      text := trim(coalesce(query, ''));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Below the minimum length, return zero rows silently. The client
  -- gates on length too; this is the server-side belt-and-braces.
  IF length(v_q) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT e.id,
           e.display_name,
           e.preferred_lang,
           o.name AS organization_name
      FROM elders e
      JOIN organizations o ON o.id = e.organization_id
     WHERE e.display_name ILIKE '%' || v_q || '%'
       -- Exclude the caller's own orgs — those are already visible via RLS,
       -- and a self-org match in this surface would be confusing UX.
       AND e.organization_id NOT IN (
         SELECT om.organization_id
           FROM organization_members om
          WHERE om.user_id = v_caller
       )
     ORDER BY e.display_name
     LIMIT 10;
END;
$$;

-- Authenticated users only. anon and public have no business with this.
REVOKE ALL ON FUNCTION find_elder_for_connection(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_elder_for_connection(text) TO authenticated;

COMMENT ON FUNCTION find_elder_for_connection(text) IS
  'Cross-tenant elder search for the proposal flow. SECURITY DEFINER, '
  'caller must be authenticated, min query length 3, excludes caller''s '
  'own orgs, returns at most 10 rows with disambiguating fields only.';
