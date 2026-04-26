-- Demo seed: Whitmore Family — pill reminders + proud moments
-- ─────────────────────────────────────────────────────────────
-- Lighter testing content for the Whitmore tenant (used internally,
-- not judge-facing). Seeds enough to exercise E + F surfaces.
--
-- Idempotent: deletes recent demo rows by elder_id within the past
-- 21 days before re-inserting. Safe to re-run.
--
-- Run after seed-demo-whitmore-family.sql.

DO $$
DECLARE
  v_org_id      uuid;
  v_margaret_id uuid;
  v_arthur_id   uuid;
  v_user_id     uuid;
  v_today       date := CURRENT_DATE;
BEGIN
  SELECT organization_id INTO v_org_id
    FROM elders
   WHERE display_name IN ('Margaret Whitmore', 'Arthur Whitmore')
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Whitmore org not found — run seed-demo-whitmore-family.sql first.';
  END IF;

  SELECT id INTO v_margaret_id FROM elders
   WHERE organization_id = v_org_id AND display_name = 'Margaret Whitmore';
  SELECT id INTO v_arthur_id FROM elders
   WHERE organization_id = v_org_id AND display_name = 'Arthur Whitmore';

  IF v_margaret_id IS NULL OR v_arthur_id IS NULL THEN
    RAISE EXCEPTION 'Whitmore elders missing — re-run seed-demo-whitmore-family.sql first.';
  END IF;

  SELECT user_id INTO v_user_id
    FROM elder_intermediaries
   WHERE elder_id = v_margaret_id
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No caregiver linked to Margaret — re-run seed-demo-whitmore-family.sql first.';
  END IF;

  -- Wipe recent demo rows
  DELETE FROM pill_reminder_events
   WHERE elder_id IN (v_margaret_id, v_arthur_id)
     AND fired_at >= now() - interval '21 days';
  DELETE FROM pill_reminders
   WHERE elder_id IN (v_margaret_id, v_arthur_id)
     AND created_at >= now() - interval '21 days';
  DELETE FROM elder_moments
   WHERE elder_id IN (v_margaret_id, v_arthur_id)
     AND occurred_on >= v_today - 21;

  -- ── Pill reminders ────────────────────────────────────────────────
  -- Margaret — recovering from hip surgery, pain mgmt
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_margaret_id,
    'Pain medication',
    'Two with breakfast, one with dinner. Don''t skip even on a good day.',
    ARRAY['08:00:00','19:00:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- Arthur — vitamins
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_arthur_id,
    'Daily vitamins',
    'B12 and D3 with toast.',
    ARRAY['09:00:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- ── Pill events past 7 days ──────────────────────────────────────
  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_margaret_id, v_org_id,
         (v_today - g.d)::timestamp + time '08:00',
         (v_today - g.d)::timestamp + time '08:08',
         'taken'
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_margaret_id AND pr.label = 'Pain medication';

  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_margaret_id, v_org_id,
         (v_today - g.d)::timestamp + time '19:00',
         CASE WHEN g.d IN (2,5) THEN NULL ELSE (v_today - g.d)::timestamp + time '19:20' END,
         CASE WHEN g.d IN (2,5) THEN 'skipped' ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_margaret_id AND pr.label = 'Pain medication';

  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_arthur_id, v_org_id,
         (v_today - g.d)::timestamp + time '09:00',
         CASE WHEN g.d = 4 THEN NULL ELSE (v_today - g.d)::timestamp + time '09:15' END,
         CASE WHEN g.d = 4 THEN 'pending' ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(0, 6) AS g(d)
   WHERE pr.elder_id = v_arthur_id AND pr.label = 'Daily vitamins';

  -- ── Proud moments ────────────────────────────────────────────────
  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_margaret_id, v_today - 1, 'walk',
     'First walk to the mailbox without the cane today. Slow but steady.',
     'nagi', NULL),
    (v_org_id, v_margaret_id, v_today - 4, 'visit',
     'Emma''s flight came in fine. They had soup together in the kitchen.',
     'caregiver', v_user_id),
    (v_org_id, v_margaret_id, v_today - 9, 'memory',
     'Pulled out the photo album from the ''79 trip — pointed out every face.',
     'nagi', NULL);

  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_arthur_id, v_today - 2, 'reading',
     'Finished the Patrick O''Brian he''s been on. Started the next one the same evening.',
     'nagi', NULL),
    (v_org_id, v_arthur_id, v_today - 6, 'hobby',
     'Tuned the old radio in the den until he got the BBC overseas service.',
     'nagi', NULL),
    (v_org_id, v_arthur_id, v_today - 11, 'meal',
     'Made his mother''s shepherd''s pie from memory. Said it was almost right.',
     'caregiver', v_user_id);

  RAISE NOTICE 'Whitmore features seed complete: 2 reminders, ~21 events, 6 moments across 2 elders.';
END $$;
