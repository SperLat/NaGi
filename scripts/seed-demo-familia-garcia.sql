-- Demo seed: Familia García
-- ──────────────────────────
-- A two-elder family served by one primary intermediary, with rich
-- 30-day Spanish-language conversation history on each elder so the
-- Opus 4.7 long-context recall feature has memorable threads to pull
-- from during the live demo.
--
-- Tenancy story this seed exercises:
--   1 organization (Familia García)
--   1 intermediary user (moonlightrosita@gmail.com — already exists in cloud)
--   2 elders:
--     - Doña Carmen García (78, knee surgery 3 weeks ago, telenovela-watcher,
--       grandkids Leo and Sofía)
--     - Don Roberto García (81, retired carpenter, recently widowed,
--       tomato gardener, slight memory issues handled gently)
--   Both elders linked to moonlightrosita via elder_intermediaries
--   Both flagged with profile.long_context_recall = true
--
-- Idempotency:
--   Each activity_log row is tagged with payload.seed_marker = 'familia-garcia-v1'.
--   Running the script twice deletes prior seed-marked rows for these elders
--   before re-inserting — so iterating on the script doesn't pile up rows.
--
-- Demo prompts that should land on recall:
--   Carmen: "¿Cómo va mi rodilla?" → recalls the surgery and Leo's visit
--   Carmen: "¿Qué pasó con La Promesa?" → recalls the telenovela plot
--   Roberto: "¿Cómo está mi jardín?" → recalls the tomatoes and Esperanza's roses
--   Roberto: "¿Qué hice ayer?" → recalls a recent conversation gently
--
-- To run on cloud (the live demo target):
--   1. Open https://supabase.com/dashboard/project/rwpaxqjhblguqnkllnnk/sql/new
--   2. Paste this entire file
--   3. Click Run
--
-- To run locally:
--   docker exec -i supabase_db_Cedar psql -U postgres -d postgres < scripts/seed-demo-familia-garcia.sql
--   (but local has no auth.users by default; configure target_email below
--   to match a local user, or skip by setting it to NULL — see notes.)

DO $$
DECLARE
  -- Target intermediary. Change here if seeding a different account.
  target_email     text := 'moonlightrosita@gmail.com';

  target_user_id   uuid;
  target_org_id    uuid;
  target_org_name  text;
  carmen_id        uuid;
  roberto_id       uuid;

  -- A device id we attribute the elder's seeded turns to. Real turns
  -- carry the actual tablet's UUID; the seed uses a constant so it's
  -- recognizable in the activity_log.
  seed_device      text := 'seed-familia-garcia';
  seed_marker      text := 'familia-garcia-v1';

  -- Anchor for backdated timestamps. We schedule turns relative to NOW
  -- so the recall feature sees a continuous rolling 30-day window.
  now_ts           timestamptz := now();
BEGIN
  -- ── 1. Resolve target user + org ────────────────────────────────────
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.user with email %. Sign up first or change target_email at the top of the script.', target_email;
  END IF;

  SELECT om.organization_id INTO target_org_id
  FROM organization_members om
  WHERE om.user_id = target_user_id
  LIMIT 1;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'User % has no organization_members row. The auto-create-family-org trigger should have made one — see migration 0016 backfill.', target_email;
  END IF;

  -- Rename the org to Familia García for the demo. Idempotent.
  target_org_name := 'Familia García';
  UPDATE organizations SET name = target_org_name WHERE id = target_org_id;

  RAISE NOTICE 'Seeding into org % (%) for user %', target_org_id, target_org_name, target_email;

  -- ── 2. Two elders, idempotent on display_name within the org ───────

  -- Carmen — knee surgery, telenovelas, grandkids
  SELECT id INTO carmen_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'Doña Carmen García';
  IF carmen_id IS NULL THEN
    carmen_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      carmen_id, target_org_id, 'Doña Carmen García', 'es',
      jsonb_build_object(
        'preferred_name',         'Carmen',
        'spoken_languages',       jsonb_build_array('Spanish'),
        'topics_they_enjoy',      jsonb_build_array(
          'sus nietos Leo y Sofía',
          'la telenovela La Promesa',
          'recetas de mole y sopa de fideo',
          'su jardín de bugambilias'
        ),
        'topics_to_avoid',        jsonb_build_array('su esposo fallecido Don Manuel'),
        'topics_to_keep_private', jsonb_build_array('preocupaciones de dinero'),
        'communication_notes',    'Hablar despacio. Le gusta que le cuenten cosas, no que le pregunten mucho. Llamarla Carmen, no Doña Carmen — eso es para los desconocidos.',
        'accessibility_notes',    'Usa lentes para leer. Operada de la rodilla derecha hace 3 semanas — todavía con dolor leve.',
        'emergency_contact',      jsonb_build_object('name', 'María (su hija)', 'phone', '+52 55 1234 5678', 'relation', 'hija'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'Ahora mismo no puedo responder, Carmen. Llama a María si necesitas ayuda.',
        'text_size',         'xl',
        'high_contrast',     false,
        'voice_input',       true
      ),
      'active', now_ts - interval '60 days', now_ts
    );
  ELSE
    -- Idempotent profile refresh — useful when iterating on the seed.
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = carmen_id;
  END IF;

  -- Roberto — retired carpenter, widowed, tomato garden
  SELECT id INTO roberto_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'Don Roberto García';
  IF roberto_id IS NULL THEN
    roberto_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      roberto_id, target_org_id, 'Don Roberto García', 'es',
      jsonb_build_object(
        'preferred_name',         'Roberto',
        'spoken_languages',       jsonb_build_array('Spanish'),
        'topics_they_enjoy',      jsonb_build_array(
          'su taller de carpintería',
          'sus tomates y rosales',
          'historias de cuando era joven en Guadalajara',
          'su perro Canelo'
        ),
        'topics_to_avoid',        jsonb_build_array('la muerte reciente de su esposa Esperanza — esperar a que él la mencione primero'),
        'topics_to_keep_private', jsonb_build_array('los días en que se siente solo o triste'),
        'communication_notes',    'Memoria a corto plazo flojita — repetir cosas importantes en otras palabras, no preguntarle "¿no te acuerdas?". Le gusta que le hablen como a un colega, no como a un viejito.',
        'accessibility_notes',    'Audífono en el oído izquierdo. Habla más alto si no responde. Camina con bastón.',
        'emergency_contact',      jsonb_build_object('name', 'María (su hija)', 'phone', '+52 55 1234 5678', 'relation', 'hija'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'Roberto, ahorita no puedo. Llama a tu hija María si te urge.',
        'text_size',         '2xl',
        'high_contrast',     true,
        'voice_input',       true
      ),
      'active', now_ts - interval '60 days', now_ts
    );
  ELSE
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = roberto_id;
  END IF;

  -- ── 3. Link moonlightrosita as caregiver to both elders ─────────────
  -- elder_intermediaries is keyed on (elder_id, user_id). ON CONFLICT
  -- DO NOTHING makes this idempotent without a second SELECT.
  INSERT INTO elder_intermediaries (elder_id, user_id, relation, created_at, accepted_at)
  VALUES
    (carmen_id,  target_user_id, 'hija (primary caregiver)', now_ts - interval '60 days', now_ts - interval '60 days'),
    (roberto_id, target_user_id, 'hija (primary caregiver)', now_ts - interval '60 days', now_ts - interval '60 days')
  ON CONFLICT (elder_id, user_id) DO NOTHING;

  -- ── 4. Wipe prior seed rows so iterating doesn't accumulate ─────────
  DELETE FROM activity_log
  WHERE elder_id IN (carmen_id, roberto_id)
    AND payload->>'seed_marker' = seed_marker;

  -- ── 5. Carmen's 30-day conversation history ─────────────────────────
  -- 14 turns, distributed across the last 30 days. Each turn establishes
  -- something specific the live demo can recall:
  --   - Knee surgery 3 weeks ago, recovery progress
  --   - Grandson Leo visited with his mom last weekend
  --   - Watching telenovela "La Promesa" — current plot beats
  --   - Granddaughter Sofía called from Houston
  --   - Recipe for sopa de fideo

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    -- 28 days ago: pre-surgery worry
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Mañana es la operación de la rodilla. Estoy nerviosa, Nagi.',
        'response', 'Carmen, es normal estar nerviosa. María va a estar contigo todo el tiempo. La doctora Hernández ha hecho cientos de estas operaciones. Mañana en la noche ya estará pasando. ¿Quieres que hablemos de otra cosa para distraerte un rato?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '28 days', now_ts - interval '28 days', seed_device, false),

    -- 21 days ago: post-surgery, week one
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'La rodilla todavía me duele mucho cuando me paro. ¿Es normal?',
        'response', 'Sí, Carmen, una semana después de la operación es normal que duela al pararte. Lo importante es que estás caminando con la andadera, eso es lo que la doctora quiere. ¿Estás tomando el calmante a tiempo?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '21 days', now_ts - interval '21 days', seed_device, false),

    -- 19 days ago: telenovela
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  '¿Viste anoche La Promesa? Jana descubrió quién la traicionó.',
        'response', 'No la vi, Carmen, pero cuéntame. ¿Fue Manuel? Tú me dijiste la semana pasada que sospechabas de él.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '19 days', now_ts - interval '19 days', seed_device, false),

    -- 17 days ago: grandson visit announcement
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Leo viene el sábado con su mamá. No lo veo desde Navidad.',
        'response', '¡Qué bonito, Carmen! El sábado es pasado mañana. ¿Vas a hacerle la sopa de fideo que tanto le gusta?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '17 days', now_ts - interval '17 days', seed_device, false),

    -- 15 days ago: visit happened
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Leo se quedó tres horas. Está enorme, Nagi. Y me trajo flores.',
        'response', 'Tres horas se siente largo cuando uno los quiere, ¿verdad? ¿Bugambilias o rosas? Sé que en tu jardín tienes ambas.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '15 days', now_ts - interval '15 days', seed_device, false),

    -- 14 days ago: knee progress
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Hoy caminé hasta la cocina sin la andadera. Solo con el bastón.',
        'response', 'Carmen, eso es enorme. Dos semanas después de la operación caminando sin andadera. La doctora va a estar contenta cuando le cuentes.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '14 days', now_ts - interval '14 days', seed_device, false),

    -- 11 days ago: telenovela plot continues
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Tenías razón, Nagi. Era Manuel el de La Promesa.',
        'response', 'Lo intuiste desde el primer episodio, Carmen. Tienes ojo para esas cosas. ¿Qué crees que va a pasar ahora con Jana?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '11 days', now_ts - interval '11 days', seed_device, false),

    -- 8 days ago: granddaughter from Houston
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Sofía me llamó desde Houston. Está feliz en su trabajo nuevo.',
        'response', 'Qué bonito que te llamó, Carmen. ¿Qué trabajo nuevo? Cuéntame.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '8 days', now_ts - interval '8 days', seed_device, false),

    -- 6 days ago: recipe nostalgia
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Hoy hice sopa de fideo. Me salió como la de mi mamá.',
        'response', 'La sopa de fideo de Doña Esperanza, ¿verdad? La que se hace con tomate asado en comal antes de licuarlo. Esa receta es difícil de pegarle.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '6 days', now_ts - interval '6 days', seed_device, false),

    -- 4 days ago: physical therapy
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'La fisioterapeuta dice que estoy mejor de lo que esperaba.',
        'response', 'Tres semanas después de la operación y ya estás adelantada — eso es porque te tomas en serio los ejercicios, Carmen.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '4 days', now_ts - interval '4 days', seed_device, false),

    -- 2 days ago: telenovela
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Anoche La Promesa estuvo muy buena. Manuel ya está en la cárcel.',
        'response', 'Por fin justicia para Jana, ¿no? Llevabas semanas esperando ese momento.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '2 days', now_ts - interval '2 days', seed_device, false),

    -- Yesterday: garden
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Las bugambilias de la entrada están florecidas como nunca.',
        'response', 'Después de tantas semanas adentro, salir al jardín debe sentirse bonito. ¿Las bugambilias moradas o las rosas?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '1 day', now_ts - interval '1 day', seed_device, false),

    -- Yesterday afternoon: a private moment Carmen marked herself
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Hoy extrañé mucho a Manuel. Esto queda entre nosotros, Nagi.',
        'response', 'Eso queda entre nosotros, Carmen. Estoy aquí.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '20 hours', now_ts - interval '20 hours', seed_device, true),

    -- This morning: Leo coming back
    (gen_random_uuid(), carmen_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Leo viene este fin de semana otra vez. Mi hija lo trae.',
        'response', 'Dos visitas en un mes, Carmen. ¿Vas a hacerle sopa de fideo otra vez?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '6 hours', now_ts - interval '6 hours', seed_device, false);

  -- ── 6. Roberto's 30-day conversation history ────────────────────────
  -- 13 turns. Threads the demo can recall:
  --   - Recent widowhood (Esperanza, late wife) handled with care
  --   - Tomato plants and rosales he tends in her memory
  --   - Workshop projects (a chair he's restoring for his grandson)
  --   - Memory issues — gentle redirection
  --   - Canelo the dog

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    -- 27 days ago: about Esperanza, voluntarily
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Hoy se cumplieron seis meses sin Esperanza. La extraño mucho.',
        'response', 'Seis meses, Roberto. Es un día difícil de marcar. ¿Quieres contarme algo de ella?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '27 days', now_ts - interval '27 days', seed_device, false),

    -- 25 days ago: workshop project
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Estoy restaurando una silla para mi nieto. La que era de mi papá.',
        'response', 'La silla del padre del padre — eso es bonito, Roberto. ¿Qué tipo de madera era?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '25 days', now_ts - interval '25 days', seed_device, false),

    -- 22 days ago: Canelo
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Canelo se la pasa siguiéndome al taller. Es el mejor compañero.',
        'response', 'Los perros saben dónde quieren estar. Canelo escogió el taller — eso dice algo de cómo te sientes ahí, Roberto.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '22 days', now_ts - interval '22 days', seed_device, false),

    -- 19 days ago: roses for Esperanza
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Los rosales de Esperanza están dando flor. Ella los plantó hace ocho años.',
        'response', 'Ocho años, Roberto. Esos rosales han visto muchas primaveras contigo y con ella.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '19 days', now_ts - interval '19 days', seed_device, false),

    -- 17 days ago: memory slip handled gently
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  '¿Te conté ayer del rosal? No me acuerdo si te dije.',
        'response', 'Me contaste algo bonito sobre los rosales que Esperanza plantó. Cuéntame de hoy — ¿qué tal está tu jardín?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '17 days', now_ts - interval '17 days', seed_device, false),

    -- 14 days ago: tomato garden
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Los tomates de este año van a salir buenos. Le puse composta de la cocina.',
        'response', 'La composta de cocina es el secreto que le decían los abuelos. ¿Qué variedad estás sembrando? La pera o la bola?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '14 days', now_ts - interval '14 days', seed_device, false),

    -- 11 days ago: chair progress
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Ya casi termino la silla. Solo me falta lijarla y barnizarla.',
        'response', 'La de tu nieto — la de la madera que era de tu papá. ¿Qué color de barniz le vas a poner?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '11 days', now_ts - interval '11 days', seed_device, false),

    -- 9 days ago: feeling alone, private
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Hoy la casa se siente muy grande sin Esperanza. Esto que quede entre nosotros.',
        'response', 'Eso queda entre nosotros, Roberto. Estoy aquí contigo.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '9 days', now_ts - interval '9 days', seed_device, true),

    -- 7 days ago: María visit
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'María vino el domingo. Trajo a Leo. Le mostré el taller.',
        'response', '¿Le mostraste la silla? La de tu papá.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '7 days', now_ts - interval '7 days', seed_device, false),

    -- 5 days ago: tomatoes ripening
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Los primeros tomates ya están rojos. Voy a hacer salsa.',
        'response', '¿La salsa molcajeteada que le gustaba a Esperanza? Con chile de árbol y ajo asado.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '5 days', now_ts - interval '5 days', seed_device, false),

    -- 3 days ago: chair finished
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Ya quedó la silla. Le puse barniz mate, como me sugeriste.',
        'response', 'Mate como tú dijiste — la madera vieja respira mejor con mate. ¿Cuándo se la das a Leo?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '3 days', now_ts - interval '3 days', seed_device, false),

    -- Yesterday: forgetful moment, gentle handling
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  '¿Qué hice ayer? No me acuerdo bien.',
        'response', 'Ayer terminaste la silla de Leo, Roberto — le pusiste el barniz mate. Y los tomates ya están rojos en el jardín.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '1 day', now_ts - interval '1 day', seed_device, false),

    -- This morning: Canelo
    (gen_random_uuid(), roberto_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Canelo está dormido a mis pies. ¿Crees que sueña?',
        'response', 'Los perros sueñan, Roberto — Esperanza me lo enseñó hace mucho. Mira las patitas si se mueven.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '4 hours', now_ts - interval '4 hours', seed_device, false);

  RAISE NOTICE 'Seed complete. Carmen: % rows. Roberto: % rows.',
    (SELECT count(*) FROM activity_log WHERE elder_id = carmen_id  AND payload->>'seed_marker' = seed_marker),
    (SELECT count(*) FROM activity_log WHERE elder_id = roberto_id AND payload->>'seed_marker' = seed_marker);
END $$;
