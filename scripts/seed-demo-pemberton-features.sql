-- Demo seed: Pemberton Family — pill reminders + proud moments
-- ─────────────────────────────────────────────────────────────
-- Layered on top of seed-demo-pemberton-family.sql. Adds the
-- new D/E/F surfaces (pastimes is auto-on; this seeds E and F):
--   - Pill reminders for each elder with realistic schedules
--   - Pill events for the past 7 days (mix of taken / skipped / pending)
--   - Proud moments aligned with the existing 45-day chat history
--     (Brandywines, Coltrane, Pearl, cardinals, B-17, walks)
--
-- Idempotent: deletes recent demo rows by elder_id within the past
-- 21 days before re-inserting. Safe to re-run.
--
-- Run after seed-demo-pemberton-family.sql. Open
-- https://supabase.com/dashboard/project/rwpaxqjhblguqnkllnnk/sql/new
-- and paste the whole file.

DO $$
DECLARE
  v_org_id     uuid;
  v_eleanor_id uuid;
  v_frances_id uuid;
  v_bill_id    uuid;
  v_user_id    uuid;
  v_today      date := CURRENT_DATE;
BEGIN
  -- Find the Pemberton org and its elders.
  SELECT id INTO v_org_id
    FROM organizations
   WHERE name = 'The Pemberton Family'
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Pemberton org not found — run seed-demo-pemberton-family.sql first.';
  END IF;

  SELECT id INTO v_eleanor_id FROM elders
   WHERE organization_id = v_org_id AND display_name = 'Eleanor Pemberton';
  SELECT id INTO v_frances_id FROM elders
   WHERE organization_id = v_org_id AND display_name = 'Frances Pemberton';
  SELECT id INTO v_bill_id    FROM elders
   WHERE organization_id = v_org_id AND display_name = 'William Pemberton';

  IF v_eleanor_id IS NULL OR v_frances_id IS NULL OR v_bill_id IS NULL THEN
    RAISE EXCEPTION 'One or more Pemberton elders missing — re-run seed-demo-pemberton-family.sql first.';
  END IF;

  -- Pick any caregiver linked to these elders for created_by attribution.
  SELECT user_id INTO v_user_id
    FROM elder_intermediaries
   WHERE elder_id = v_eleanor_id
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No caregiver linked to Eleanor — re-run seed-demo-pemberton-family.sql first.';
  END IF;

  -- ── Wipe prior demo rows for these elders (last 21 days) ──────────
  DELETE FROM pill_reminder_events
   WHERE elder_id IN (v_eleanor_id, v_frances_id, v_bill_id)
     AND fired_at >= now() - interval '21 days';
  DELETE FROM pill_reminders
   WHERE elder_id IN (v_eleanor_id, v_frances_id, v_bill_id)
     AND created_at >= now() - interval '21 days';
  DELETE FROM elder_moments
   WHERE elder_id IN (v_eleanor_id, v_frances_id, v_bill_id)
     AND occurred_on >= v_today - 21;

  -- ══════════════════════════════════════════════════════════════════
  -- PILL REMINDERS — one schedule per elder
  -- ══════════════════════════════════════════════════════════════════

  -- Eleanor — morning blood pressure med, daily
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_eleanor_id,
    'Lisinopril (morning)',
    'With breakfast — keeps her BP steady.',
    ARRAY['08:00:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- Frances — morning + evening (memory support + sleep)
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_frances_id,
    'Donepezil + multivitamin',
    'Two pills with toast and tea. The aide places them by her cup.',
    ARRAY['07:30:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_frances_id,
    'Melatonin (evening)',
    'Helps her sleep. Skip if she napped late.',
    ARRAY['20:30:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- Bill — COPD inhaler twice daily
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_bill_id,
    'Tiotropium inhaler',
    'Two puffs, morning and evening. Rinse mouth after.',
    ARRAY['08:00:00','20:00:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- ══════════════════════════════════════════════════════════════════
  -- PILL EVENTS — past 7 days, mixed status
  -- ══════════════════════════════════════════════════════════════════
  -- Eleanor: 6 of 7 taken, 1 skipped (the brand: skipped is OK).
  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_eleanor_id, v_org_id,
         (v_today - g.d)::timestamp + time '08:00',
         CASE WHEN g.d = 3 THEN NULL ELSE (v_today - g.d)::timestamp + time '08:12' END,
         CASE WHEN g.d = 3 THEN 'skipped' ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_eleanor_id AND pr.label = 'Lisinopril (morning)';

  -- Frances morning: 5 taken, 1 skipped, 1 pending (today, late). evening: 4 taken, 3 skipped.
  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_frances_id, v_org_id,
         (v_today - g.d)::timestamp + time '07:30',
         CASE WHEN g.d IN (0,2) THEN NULL ELSE (v_today - g.d)::timestamp + time '07:50' END,
         CASE WHEN g.d = 0 THEN 'pending'
              WHEN g.d = 2 THEN 'skipped'
              ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(0, 6) AS g(d)
   WHERE pr.elder_id = v_frances_id AND pr.label = 'Donepezil + multivitamin';

  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_frances_id, v_org_id,
         (v_today - g.d)::timestamp + time '20:30',
         CASE WHEN g.d IN (1,4,6) THEN NULL ELSE (v_today - g.d)::timestamp + time '20:55' END,
         CASE WHEN g.d IN (1,4,6) THEN 'skipped' ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_frances_id AND pr.label = 'Melatonin (evening)';

  -- Bill: morning all taken (he's reliable), evening 5 taken / 2 skipped (forgets sometimes)
  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_bill_id, v_org_id,
         (v_today - g.d)::timestamp + time '08:00',
         (v_today - g.d)::timestamp + time '08:05',
         'taken'
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_bill_id AND pr.label = 'Tiotropium inhaler';

  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_bill_id, v_org_id,
         (v_today - g.d)::timestamp + time '20:00',
         CASE WHEN g.d IN (3,5) THEN NULL ELSE (v_today - g.d)::timestamp + time '20:18' END,
         CASE WHEN g.d IN (3,5) THEN 'skipped' ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_bill_id AND pr.label = 'Tiotropium inhaler';

  -- ══════════════════════════════════════════════════════════════════
  -- PROUD MOMENTS — aligned with the 45-day chat seeds
  -- ══════════════════════════════════════════════════════════════════
  -- Brand stance: small, real things. The elder's words. No diagnostics.

  -- Eleanor — gardener, jazz devotee, recently widowed
  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_eleanor_id, v_today - 1, 'garden',
     'The Brandywines came in heavier than last year — three on the kitchen sill ripening together.',
     'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 3, 'memory',
     'Pulled out Charles''s Coltrane record while it was raining. A Love Supreme, side two.',
     'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 5, 'visit',
     'Sofia came by with the dog and stayed for tea. She laughed at the cat''s portrait.',
     'caregiver', v_user_id),
    (v_org_id, v_eleanor_id, v_today - 8, 'reading',
     'Finished the chapter she'' been on for two weeks — said the ending was kinder than she expected.',
     'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 12, 'garden',
     'Pruned the climbing rose at the back wall. Charles planted that one in ''93.',
     'nagi', NULL);

  -- Frances — mild dementia, retired schoolteacher, beloved cat Pearl
  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_frances_id, v_today - 0, 'visit',
     'Pearl curled up on her lap during the morning chat. She laughed — said Pearl had picked her side.',
     'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 2, 'memory',
     'Told the story of her third-grade reading circle again — remembered every kid by name.',
     'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 4, 'memory',
     'The cardinal was back at the window. She watched it for ten minutes before saying anything.',
     'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 7, 'meal',
     'Asked the aide for buttered toast cut into triangles, like her mother used to make.',
     'caregiver', v_user_id),
    (v_org_id, v_frances_id, v_today - 11, 'memory',
     'Sang most of "Bringing in the Sheaves" without prompting — first time in months.',
     'nagi', NULL);

  -- Bill — ex-Army Korea, model plane builder, daily walker
  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_bill_id, v_today - 1, 'hobby',
     'Finished the wing assembly on the B-17. Said the rigging took longer than the airframe.',
     'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 2, 'walk',
     'Did the full loop around the block — twice. Said the COPD was quieter today.',
     'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 5, 'memory',
     'Told the story about Charles fixing the carburetor in ''68 — laughed at the part where they used a hairpin.',
     'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 8, 'visit',
     'The neighbor''s grandson stopped by to look at the planes. Bill walked him through every model.',
     'caregiver', v_user_id),
    (v_org_id, v_bill_id, v_today - 14, 'walk',
     'Made it to the bench past the post office and back. New personal best this month.',
     'nagi', NULL);

  RAISE NOTICE 'Pemberton features seed complete: 4 reminders, ~30 events, 15 moments across 3 elders.';
END $$;
