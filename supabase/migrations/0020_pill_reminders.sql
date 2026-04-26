-- Pill reminders — first actionable health surface.
-- ─────────────────────────────────────────────────
-- The elder's profile already carries medication LABELS (free-text, no
-- dose data) for tone calibration in Nagi's per-elder system block.
-- These tables add the *actionable* layer: when a dose fires, did the
-- elder take it, did they snooze, did they skip.
--
-- v1 has no scheduling substrate — the kiosk polls every ~30s and
-- creates events on-the-fly via the unique (reminder_id, fired_at)
-- index. Phase 2 (documented in the plan) will add pg_cron + soft-chime
-- push for elders not currently looking at the kiosk.
--
-- Brand stance — engineered into the schema:
--   - status='skipped' is a first-class success state, not a failure.
--     Nagi accepts "Salté" warmly. The family sees the count, the elder
--     is never chased.
--   - "Missed" is computed at view-time (expected − taken − skipped),
--     never stored. Storing "missed" would tempt UI that frames the
--     elder's day in deficit terms.
--   - notes is for the family's note to themselves ("with breakfast"),
--     not advice the elder will be quizzed on.

-- ── Tables ───────────────────────────────────────────────────────────

CREATE TABLE pill_reminders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  elder_id        uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  label           text        NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  notes           text                 CHECK (notes IS NULL OR length(notes) <= 500),
  -- Times in elder's local day (24h, UTC offset is device-local).
  -- The kiosk evaluates due-ness against the device clock. Phase 2
  -- will store an explicit timezone on the elder row.
  times           time[]      NOT NULL CHECK (array_length(times, 1) BETWEEN 1 AND 8),
  -- 0 = Sunday … 6 = Saturday, matching JS Date.getDay().
  days_of_week    int[]       NOT NULL DEFAULT array[0,1,2,3,4,5,6]
                              CHECK (array_length(days_of_week, 1) BETWEEN 1 AND 7),
  active          boolean     NOT NULL DEFAULT true,
  created_by      uuid        NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pill_reminders_elder_active_idx
  ON pill_reminders (elder_id, active);

CREATE TABLE pill_reminder_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id      uuid        NOT NULL REFERENCES pill_reminders(id) ON DELETE CASCADE,
  elder_id         uuid        NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The slot this event represents — the scheduled time, rounded to
  -- the minute (e.g. today 08:00:00). Idempotency: a second insert for
  -- the same slot is a no-op via the unique index below.
  fired_at         timestamptz NOT NULL,
  acknowledged_at  timestamptz,
  snoozed_until    timestamptz,
  status           text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'taken', 'skipped')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pill_reminder_events_elder_fired_idx
  ON pill_reminder_events (elder_id, fired_at DESC);

-- Idempotency: the kiosk inserts events as it sees them; multiple
-- inserts for the same slot collapse to one row.
CREATE UNIQUE INDEX pill_reminder_events_slot_idx
  ON pill_reminder_events (reminder_id, fired_at);

-- Realtime: receiving family wants near-instant ack feedback when the
-- elder taps "Tomé".
ALTER TABLE pill_reminders        REPLICA IDENTITY FULL;
ALTER TABLE pill_reminder_events  REPLICA IDENTITY FULL;

-- ── RLS on pill_reminders ────────────────────────────────────────────
ALTER TABLE pill_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view pill reminders"
  ON pill_reminders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org members can create pill reminders"
  ON pill_reminders FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org members can update pill reminders"
  ON pill_reminders FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Only the creator can hard-delete; the UI prefers setting active=false.
CREATE POLICY "creators can delete their reminders"
  ON pill_reminders FOR DELETE
  USING (created_by = auth.uid());

-- ── RLS on pill_reminder_events ──────────────────────────────────────
ALTER TABLE pill_reminder_events ENABLE ROW LEVEL SECURITY;

-- Everyone in the org reads events.
CREATE POLICY "org members can view pill reminder events"
  ON pill_reminder_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Org members (which includes the elder via their kiosk session if
-- the elder happens to be an org member; in our model the elder is
-- not an auth user, so this is the caregiver writing on the elder's
-- behalf when they tap the kiosk pill — same auth context as the
-- existing activity_log writes from elder UI).
CREATE POLICY "org members can write pill reminder events"
  ON pill_reminder_events FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org members can update pill reminder events"
  ON pill_reminder_events FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
