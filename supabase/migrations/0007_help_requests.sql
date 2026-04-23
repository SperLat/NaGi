-- Help requests: elder taps "Necesito Ayuda" → intermediary gets alerted in real time.

CREATE TABLE help_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'acknowledged')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid        REFERENCES auth.users(id)
);

-- Supabase Realtime needs replica identity to deliver row payloads
ALTER TABLE help_requests REPLICA IDENTITY FULL;

-- Index for the most common query: pending requests per org
CREATE INDEX idx_help_requests_org_status ON help_requests (organization_id, status, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

-- Any org member can see their org's requests (intermediary dashboard)
CREATE POLICY "org members can view help requests"
  ON help_requests FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Any org member can create a request on behalf of an elder in their org
CREATE POLICY "org members can create help requests"
  ON help_requests FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Any org member can acknowledge (update status)
CREATE POLICY "org members can acknowledge help requests"
  ON help_requests FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
