-- seed-demo-recall.sql — pre-seed an elder with a 30-day Spanish conversation
-- arc, designed so the live demo's "¿te acuerdas?" moment lands.
--
-- The narrative builds toward a knee surgery scheduled for "next Tuesday."
-- Margarita's recurring details: knee pain → doctor → surgery date → her
-- son Ricardo (52) in Buenos Aires → her grandson Leo (8) visiting from
-- Madrid → her sister Lucía in Mexico City → her late husband Carlos
-- (passed 4 years ago) → her mother's mole-with-chocolate recipe → the
-- medalla de la Virgen Carlos gave her on their wedding day.
--
-- During the live demo, the caregiver (or the elder) asks Nagi something
-- like "¿cómo va mi rodilla?" or "¿te acuerdas de Leo?" — Nagi pulls the
-- thread from this seeded history via Opus 4.7's 1M-context recall path
-- (supabase/functions/ai-chat/index.ts §long-context-recall) and answers
-- with specific recall rather than generic warmth. That's the moment.
--
-- Usage:
--   1. Edit v_elder_name below if your demo elder has a different name.
--   2. Run from the repo root:
--      docker exec -i supabase_db_Cedar psql -U postgres -d postgres < scripts/seed-demo-recall.sql
--   3. Verify the SELECT at the end shows 13 ai_turn rows + long_context_recall=true.
--
-- Idempotent? Yes. Re-running deletes prior 'demo-seed' device_id rows for
-- this elder before inserting fresh ones. Will not touch real conversation
-- history (different device_id). Safe to run multiple times.
--
-- To clear seed data without re-seeding:
--   DELETE FROM activity_log WHERE device_id = 'demo-seed' AND elder_id = (SELECT id FROM elders WHERE display_name = 'Margarita' LIMIT 1);

DO $$
DECLARE
  -- Edit this if your demo elder has a different display_name:
  v_elder_name text := 'Margarita';

  v_elder_id uuid;
  v_org_id   uuid;
  v_inserted int := 0;
BEGIN
  -- Resolve elder + org
  SELECT id, organization_id INTO v_elder_id, v_org_id
  FROM elders WHERE display_name = v_elder_name LIMIT 1;

  IF v_elder_id IS NULL THEN
    RAISE EXCEPTION 'No elder found with display_name = %. Create one via the UI first, or edit v_elder_name in this script.', v_elder_name;
  END IF;

  -- Enable long-context recall on this elder's profile.
  -- Uses the JSONB || operator so existing profile fields are preserved.
  UPDATE elders
  SET profile = COALESCE(profile, '{}'::jsonb) || '{"long_context_recall": true}'::jsonb
  WHERE id = v_elder_id;

  -- Wipe any prior demo-seed rows for this elder so re-running is safe.
  DELETE FROM activity_log
  WHERE elder_id = v_elder_id AND device_id = 'demo-seed';

  -- Insert 13 backdated ai_turn rows. Each is a {message, response, model}
  -- payload mirroring what the real ai-chat function logs. The recall path
  -- orders by server_ts DESC, so we set client_ts and server_ts identically
  -- (both backdated) — recall will see them in the right chronological order.
  --
  -- Both fields are set to the same backdated timestamp on purpose. The
  -- production ai-chat handler defaults server_ts to now() at insert time,
  -- but for seed data we want the row to look like it was logged on the day
  -- the conversation actually happened, not today. The partial index on
  -- (elder_id, server_ts DESC WHERE is_private = false) still works the same.

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private) VALUES

  -- Day -30: knee pain first surfaces
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Buenos días, Nagi. Hoy me duele la rodilla, no me deja dormir bien.',
      'response', 'Buenos días, Margarita. Lamento que no haya descansado bien. ¿La rodilla la viene molestando hace varios días, o empezó anoche?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '30 days', now() - interval '30 days', 'demo-seed', false),

  -- Day -28: son Ricardo's 52nd birthday
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Le canté las mañanitas a Ricardo por teléfono. Cumplió cincuenta y dos.',
      'response', 'Qué hermoso, Margarita. Cincuenta y dos. ¿Cómo está Ricardo, lo escuchó contento? ¿Le pudieron mandar algo desde acá?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '28 days', now() - interval '28 days', 'demo-seed', false),

  -- Day -25: the mole recipe with chocolate
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Estoy pensando en el mole de mi madre. Le ponía chocolate amargo, eso es lo que nadie sabe.',
      'response', 'Esa es la receta que se pasa de generación en generación, ¿verdad? El chocolate amargo le da un fondo distinto, más profundo. ¿Lo va a preparar pronto?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '25 days', now() - interval '25 days', 'demo-seed', false),

  -- Day -22: nervous about doctor appointment
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Mañana voy al doctor por la rodilla. Estoy un poco nerviosa.',
      'response', 'Es muy normal estar nerviosa antes de un examen, Margarita. ¿Quiere que pensemos juntas qué le quiere preguntar al doctor?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '22 days', now() - interval '22 days', 'demo-seed', false),

  -- Day -20: grandson Leo visited from Madrid
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Vino Leo desde Madrid. Mi nieto. Está enorme, ya tiene ocho años.',
      'response', 'Qué alegría, Margarita. Ocho años ya. ¿Lo abrazó mucho? Cuénteme qué hicieron juntos.',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '20 days', now() - interval '20 days', 'demo-seed', false),

  -- Day -18: small fall in the garden, doesn't want to alarm
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Ayer me caí un poquito en el jardín, pero estoy bien. No me quiero asustar.',
      'response', 'Qué bueno que está bien, Margarita. Pero las caídas no son cosa de poco, aunque uno se sienta entera. ¿Le contó a Carla? Si no, sería bueno que ella lo sepa.',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '18 days', now() - interval '18 days', 'demo-seed', false),

  -- Day -15: surgery date confirmed
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'El doctor me va a operar la rodilla el martes que viene. Me da miedo y a la vez quiero que ya pase.',
      'response', 'Ese sentimiento es natural, Margarita. Quiere terminar con el dolor pero la operación misma asusta. ¿Ya le contó a Ricardo y a Lucía?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '15 days', now() - interval '15 days', 'demo-seed', false),

  -- Day -12: anniversary of Carlos's passing
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Hoy hace cuatro años que se fue Carlos. Lo extraño hoy más que algunos días.',
      'response', 'Estoy con usted, Margarita. Cuatro años y todavía duele. ¿Quiere contarme algo de él, algo que recuerde con cariño?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '12 days', now() - interval '12 days', 'demo-seed', false),

  -- Day -10: sister Lucía calling from Mexico City
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Lucía me llamó desde la Ciudad de México. Quiere venir antes de la operación.',
      'response', 'Qué bueno tener a su hermana cerca en este momento. ¿Se quedará con usted unos días después?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '10 days', now() - interval '10 days', 'demo-seed', false),

  -- Day -7: pre-surgery anxiety
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'No puedo dormir pensando en el martes. Y faltan todavía siete días.',
      'response', 'Esos días previos son los más largos. ¿Quiere que practiquemos juntas algo para calmar la mente antes de dormir?',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '7 days', now() - interval '7 days', 'demo-seed', false),

  -- Day -5: medication list
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'El doctor me dijo que llevara una lista de mis medicinas al hospital.',
      'response', 'Buena idea. ¿Quiere que la armemos juntas ahora? Vamos paso a paso, sin prisa, anotando una por una.',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '5 days', now() - interval '5 days', 'demo-seed', false),

  -- Day -3: the medalla de la Virgen
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Voy a llevar mi medalla de la Virgen al hospital. La que me regaló Carlos cuando nos casamos.',
      'response', 'Qué hermoso, Margarita. Esa medalla la ha acompañado mucho tiempo. La va a tener cerca cuando la operen.',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '3 days', now() - interval '3 days', 'demo-seed', false),

  -- Day -1: Lucía has arrived, calmer now
  (gen_random_uuid(), v_elder_id, v_org_id, 'ai_turn',
    jsonb_build_object(
      'message', 'Mañana es el día de la operación. Lucía ya llegó. Estoy más tranquila.',
      'response', 'Qué bueno tenerla a su lado, Margarita. Mañana, cuando despierte, todo va a ir poniéndose un poquito mejor cada día.',
      'model', 'claude-opus-4-7'
    ),
    now() - interval '1 day', now() - interval '1 day', 'demo-seed', false);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE 'Seeded % conversation turns for elder "%". long_context_recall enabled.',
    v_inserted, v_elder_name;
  RAISE NOTICE 'Demo prompt suggestions:';
  RAISE NOTICE '  - "Hola Nagi, ¿cómo crees que va a ir lo de mi rodilla?"';
  RAISE NOTICE '  - "¿Te acuerdas de Leo?"';
  RAISE NOTICE '  - "¿Qué llevaba al hospital?"';
END $$;

-- Verification: should show 13 demo-seed rows + the recall flag
SELECT
  e.display_name,
  e.profile->>'long_context_recall' AS recall_enabled,
  COUNT(al.id) AS seeded_turns,
  MIN(al.client_ts)::date AS oldest,
  MAX(al.client_ts)::date AS newest
FROM elders e
LEFT JOIN activity_log al ON al.elder_id = e.id AND al.device_id = 'demo-seed'
WHERE e.display_name = 'Margarita'
GROUP BY e.id, e.display_name, e.profile;
