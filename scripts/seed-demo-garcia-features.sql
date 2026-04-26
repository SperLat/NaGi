-- Demo seed: Familia García — pill reminders + proud moments
-- ────────────────────────────────────────────────────────────
-- Lighter testing content for the García tenant (used internally,
-- not judge-facing). Seeds Spanish-language moments + reminders.
--
-- Idempotent: deletes recent demo rows by elder_id within the past
-- 21 days before re-inserting. Safe to re-run.
--
-- Run after seed-demo-familia-garcia.sql.

DO $$
DECLARE
  v_org_id     uuid;
  v_carmen_id  uuid;
  v_roberto_id uuid;
  v_user_id    uuid;
  v_today      date := CURRENT_DATE;
BEGIN
  SELECT id INTO v_org_id
    FROM organizations
   WHERE name = 'Familia García'
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'García org not found — run seed-demo-familia-garcia.sql first.';
  END IF;

  SELECT id INTO v_carmen_id FROM elders
   WHERE organization_id = v_org_id AND display_name = 'Doña Carmen García';
  SELECT id INTO v_roberto_id FROM elders
   WHERE organization_id = v_org_id AND display_name = 'Don Roberto García';

  IF v_carmen_id IS NULL OR v_roberto_id IS NULL THEN
    RAISE EXCEPTION 'García elders missing — re-run seed-demo-familia-garcia.sql first.';
  END IF;

  SELECT user_id INTO v_user_id
    FROM elder_intermediaries
   WHERE elder_id = v_carmen_id
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No caregiver linked to Carmen — re-run seed-demo-familia-garcia.sql first.';
  END IF;

  -- Wipe recent demo rows
  DELETE FROM pill_reminder_events
   WHERE elder_id IN (v_carmen_id, v_roberto_id)
     AND fired_at >= now() - interval '21 days';
  DELETE FROM pill_reminders
   WHERE elder_id IN (v_carmen_id, v_roberto_id)
     AND created_at >= now() - interval '21 days';
  DELETE FROM elder_moments
   WHERE elder_id IN (v_carmen_id, v_roberto_id)
     AND occurred_on >= v_today - 21;

  -- ── Pill reminders ────────────────────────────────────────────────
  -- Carmen — knee surgery recovery, dolor manejado
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_carmen_id,
    'Medicación para la rodilla',
    'Con el desayuno y con la cena. Mejor con comida.',
    ARRAY['08:30:00','19:30:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- Roberto — cardiac med
  INSERT INTO pill_reminders (
    organization_id, elder_id, label, notes, times, days_of_week,
    active, created_by
  ) VALUES (
    v_org_id, v_roberto_id,
    'Pastilla del corazón',
    'Por la mañana, antes del café.',
    ARRAY['07:30:00']::time[],
    ARRAY[0,1,2,3,4,5,6],
    true, v_user_id
  );

  -- ── Pill events past 7 days ──────────────────────────────────────
  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_carmen_id, v_org_id,
         (v_today - g.d)::timestamp + time '08:30',
         CASE WHEN g.d = 5 THEN NULL ELSE (v_today - g.d)::timestamp + time '08:45' END,
         CASE WHEN g.d = 5 THEN 'skipped' ELSE 'taken' END
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_carmen_id AND pr.label = 'Medicación para la rodilla';

  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_carmen_id, v_org_id,
         (v_today - g.d)::timestamp + time '19:30',
         (v_today - g.d)::timestamp + time '19:50',
         'taken'
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_carmen_id AND pr.label = 'Medicación para la rodilla';

  INSERT INTO pill_reminder_events (reminder_id, elder_id, organization_id, fired_at, acknowledged_at, status)
  SELECT pr.id, v_roberto_id, v_org_id,
         (v_today - g.d)::timestamp + time '07:30',
         (v_today - g.d)::timestamp + time '07:35',
         'taken'
    FROM pill_reminders pr,
         generate_series(1, 7) AS g(d)
   WHERE pr.elder_id = v_roberto_id AND pr.label = 'Pastilla del corazón';

  -- ── Proud moments (Spanish) ──────────────────────────────────────
  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_carmen_id, v_today - 1, 'visit',
     'Vino su nieta Esperanza con flores. Se quedaron viendo telenovelas hasta tarde.',
     'nagi', NULL),
    (v_org_id, v_carmen_id, v_today - 4, 'walk',
     'Caminó hasta la cocina y de regreso sin la andadera. Pequeño paso, gran día.',
     'nagi', NULL),
    (v_org_id, v_carmen_id, v_today - 8, 'memory',
     'Contó la historia de cuando conoció a Don Roberto en el baile del pueblo. Sonrió todo el rato.',
     'caregiver', v_user_id);

  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    (v_org_id, v_roberto_id, v_today - 1, 'garden',
     'Los tomates están dando buenos esta semana. Tres en la repisa madurando.',
     'nagi', NULL),
    (v_org_id, v_roberto_id, v_today - 3, 'memory',
     'Habló del taller de carpintería de su padre. Recordaba el olor del cedro.',
     'nagi', NULL),
    (v_org_id, v_roberto_id, v_today - 9, 'hobby',
     'Terminó la mesita para el balcón. Dijo que la madera estaba contenta.',
     'caregiver', v_user_id);

  RAISE NOTICE 'García features seed complete: 2 reminders, ~21 events, 6 moments across 2 elders.';
END $$;
