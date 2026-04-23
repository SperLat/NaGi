-- RLS helper: true if the calling user is a member of the given org.
-- SECURITY DEFINER so it can read organization_members without extra grants.
CREATE OR REPLACE FUNCTION is_org_member(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org AND user_id = auth.uid()
  );
$$;

-- ── organizations ──────────────────────────────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY organizations_insert ON organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY organizations_update ON organizations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM organization_members
            WHERE organization_id = id AND user_id = auth.uid()
            AND role IN ('owner', 'admin'))
  );

CREATE POLICY organizations_delete ON organizations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM organization_members
            WHERE organization_id = id AND user_id = auth.uid()
            AND role = 'owner')
  );

-- ── organization_members ───────────────────────────────────────────────────────
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_select ON organization_members
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY org_members_insert ON organization_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM organization_members
            WHERE organization_id = organization_members.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin'))
  );

CREATE POLICY org_members_delete ON organization_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_members om
               WHERE om.organization_id = organization_members.organization_id
                 AND om.user_id = auth.uid()
                 AND om.role IN ('owner', 'admin'))
  );

-- ── elders ─────────────────────────────────────────────────────────────────────
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;

CREATE POLICY elders_select ON elders
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY elders_insert ON elders
  FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY elders_update ON elders
  FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY elders_delete ON elders
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM organization_members
            WHERE organization_id = elders.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin'))
  );

-- ── elder_intermediaries ───────────────────────────────────────────────────────
ALTER TABLE elder_intermediaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY elder_intermediaries_select ON elder_intermediaries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM elders e WHERE e.id = elder_id AND is_org_member(e.organization_id))
  );

CREATE POLICY elder_intermediaries_insert ON elder_intermediaries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM elders e WHERE e.id = elder_id AND is_org_member(e.organization_id))
  );

CREATE POLICY elder_intermediaries_delete ON elder_intermediaries
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM elders e
               JOIN organization_members om ON om.organization_id = e.organization_id
               WHERE e.id = elder_id AND om.user_id = auth.uid()
               AND om.role IN ('owner', 'admin'))
  );

-- ── activity_log ───────────────────────────────────────────────────────────────
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_log_select ON activity_log
  FOR SELECT USING (is_org_member(organization_id));

-- Insert allowed for org members (device syncs up on reconnect)
CREATE POLICY activity_log_insert ON activity_log
  FOR INSERT WITH CHECK (is_org_member(organization_id));

-- No UPDATE or DELETE — append-only by design.

-- ── ai_interactions ────────────────────────────────────────────────────────────
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_interactions_select ON ai_interactions
  FOR SELECT USING (is_org_member(organization_id));

-- Edge function inserts via service role key; no direct client insert policy needed.
