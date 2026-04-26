-- Cross-tenant demo bridge: Eleanor (Pemberton) ↔ Maggie (Whitmore)
-- ──────────────────────────────────────────────────────────────────
-- Creates an ACTIVE connection between two elders living in different
-- family organizations, plus a handful of historical messages so the
-- demo doesn't start from an empty inbox.
--
-- This is THE feature that proves Nagi's tenancy story: same Postgres,
-- same edge functions, RLS-isolated organizations — yet two elders can
-- exchange messages because their families both consented to the bridge.
--
-- Prerequisites:
--   - Pemberton seed run (creates Eleanor Pemberton)
--   - Whitmore  seed run (creates Margaret Whitmore — display name is
--     'Margaret Whitmore', preferred_name 'Maggie' in profile)
--   - Migration 0019 applied (creates elder_connections + elder_messages)
--
-- Idempotency: re-running deletes any prior seed-marked messages and
-- recreates the connection if missing. The connection row itself is
-- upserted via the unique pair constraint.
--
-- To run:
--   1. Open https://supabase.com/dashboard/project/rwpaxqjhblguqnkllnnk/sql/new
--   2. Paste this whole file -> Run

DO $$
DECLARE
  eleanor_id     uuid;
  maggie_id      uuid;
  conn_id        uuid;
  pemberton_org  uuid;
  whitmore_org   uuid;
  pemberton_user uuid;
  whitmore_user  uuid;
  eleanor_lt_maggie boolean;
  v_a uuid;
  v_b uuid;
  seed_marker    text := 'eleanor-maggie-bridge-v1';
  now_ts         timestamptz := now();
BEGIN
  -- ── Locate the elders + their orgs + a user to attribute the proposal to ──
  SELECT id, organization_id INTO eleanor_id, pemberton_org
    FROM elders
   WHERE display_name = 'Eleanor Pemberton'
   LIMIT 1;

  IF eleanor_id IS NULL THEN
    RAISE EXCEPTION 'Eleanor Pemberton not found. Run the Pemberton seed first.';
  END IF;

  SELECT id, organization_id INTO maggie_id, whitmore_org
    FROM elders
   WHERE display_name = 'Margaret Whitmore'
   LIMIT 1;

  IF maggie_id IS NULL THEN
    RAISE EXCEPTION 'Margaret Whitmore not found. Run the Whitmore seed first.';
  END IF;

  SELECT user_id INTO pemberton_user
    FROM organization_members
   WHERE organization_id = pemberton_org
   ORDER BY created_at ASC
   LIMIT 1;

  SELECT user_id INTO whitmore_user
    FROM organization_members
   WHERE organization_id = whitmore_org
   ORDER BY created_at ASC
   LIMIT 1;

  IF pemberton_user IS NULL OR whitmore_user IS NULL THEN
    RAISE EXCEPTION 'Could not resolve org members for both elders. Make sure both seeds ran cleanly.';
  END IF;

  -- ── Normalize the pair so elder_a_id < elder_b_id (matches the table CHECK) ──
  eleanor_lt_maggie := eleanor_id < maggie_id;
  IF eleanor_lt_maggie THEN
    v_a := eleanor_id;  v_b := maggie_id;
  ELSE
    v_a := maggie_id;   v_b := eleanor_id;
  END IF;

  -- ── Upsert the connection as ACTIVE ───────────────────────────────────
  INSERT INTO elder_connections (
    elder_a_id, elder_b_id, proposed_by, proposed_at, accepted_by, accepted_at, status
  ) VALUES (
    v_a, v_b,
    pemberton_user, now_ts - interval '14 days',
    whitmore_user,  now_ts - interval '14 days',
    'active'
  )
  ON CONFLICT (elder_a_id, elder_b_id) DO UPDATE
     SET status      = 'active',
         proposed_by = EXCLUDED.proposed_by,
         proposed_at = EXCLUDED.proposed_at,
         accepted_by = EXCLUDED.accepted_by,
         accepted_at = EXCLUDED.accepted_at
  RETURNING id INTO conn_id;

  -- ── Wipe prior seeded messages on this connection ────────────────────
  DELETE FROM elder_messages
   WHERE connection_id = conn_id
     AND body LIKE '%' || seed_marker || '%';

  -- ── Historical messages — bilingual, pre-translated for instant playback ──
  -- These are READ (read_at set) so the elder home pill doesn't show them
  -- as unread. The next message inserted by the live demo will be the
  -- first unread for the receiver.
  --
  -- Pre-populated body_translated so the receiver can hear the message
  -- in their preferred language without the translate-message edge fn
  -- having to run for the historical content. The seed_marker substring
  -- is embedded in body so DELETE-on-rerun catches them.

  -- Maggie -> Eleanor (English source, Spanish translation cached)
  INSERT INTO elder_messages (
    connection_id, from_elder_id, body, body_translated, created_at, read_at
  ) VALUES (
    conn_id, maggie_id,
    'Eleanor — my hip is finally letting me walk Biscuit around the whole block. Thinking of you and the river path. (' || seed_marker || ')',
    jsonb_build_object(
      'es',
      'Eleanor — la cadera por fin me deja caminar a Biscuit alrededor de toda la cuadra. Pensando en ti y en el camino del río.'
    ),
    now_ts - interval '11 days',
    now_ts - interval '11 days'
  );

  -- Eleanor -> Maggie (Spanish source, English translation cached)
  INSERT INTO elder_messages (
    connection_id, from_elder_id, body, body_translated, created_at, read_at
  ) VALUES (
    conn_id, eleanor_id,
    'Maggie, qué buena noticia lo de la cadera. Aquí los rosales de Charles ya están dando flor — me acordé de ti cuando salió el primero. (' || seed_marker || ')',
    jsonb_build_object(
      'en',
      'Maggie, that''s such good news about the hip. Charles''s rose bushes are blooming here — I thought of you when the first one opened.'
    ),
    now_ts - interval '8 days',
    now_ts - interval '8 days'
  );

  -- Maggie -> Eleanor (English source, Spanish translation cached)
  INSERT INTO elder_messages (
    connection_id, from_elder_id, body, body_translated, created_at, read_at
  ) VALUES (
    conn_id, maggie_id,
    'Emma comes home from Ann Arbor next weekend. She wants to learn to bake — any chance you''d share your sopa de fideo trick over the phone? (' || seed_marker || ')',
    jsonb_build_object(
      'es',
      'Emma viene de Ann Arbor el próximo fin de semana. Quiere aprender a cocinar — ¿me ayudarías a explicarle el truco de tu sopa de fideo por teléfono?'
    ),
    now_ts - interval '4 days',
    now_ts - interval '4 days'
  );

  -- Eleanor -> Maggie (Spanish source, English translation cached) — UNREAD
  -- The most recent message stays unread so the demo shows the elder
  -- home pill with "📬 Mensaje de Maggie" / "📬 Message from Eleanor"
  -- on whichever side the judge logs in as.
  INSERT INTO elder_messages (
    connection_id, from_elder_id, body, body_translated, created_at, read_at
  ) VALUES (
    conn_id, eleanor_id,
    'Maggie querida — claro que sí, le cuento todo a Emma. El secreto del fideo es tostarlo en el comal antes de echarle el caldo. Dile que la espero cuando puedan venir. (' || seed_marker || ')',
    jsonb_build_object(
      'en',
      'Maggie dear — of course I''ll teach Emma. The secret to the fideo is toasting it in the dry pan before adding the broth. Tell her I''ll be waiting whenever you two can come visit.'
    ),
    now_ts - interval '6 hours',
    NULL
  );

  RAISE NOTICE 'Bridge created. Eleanor: %, Maggie: %, connection: %', eleanor_id, maggie_id, conn_id;
  RAISE NOTICE 'Messages: % total, 1 unread to Maggie',
    (SELECT count(*) FROM elder_messages WHERE connection_id = conn_id);
END $$;
