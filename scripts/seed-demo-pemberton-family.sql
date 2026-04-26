-- Demo seed: The Pemberton Family
-- ────────────────────────────────
-- Three-elder English demo with 45 days of conversation history per
-- elder. Designed for a "single family, three loved ones" narrative —
-- shows the multi-elder-per-tenant model at richer scale than the
-- two-elder García and Whitmore seeds.
--
-- Tenancy story:
--   1 organization (The Pemberton Family)
--   1 intermediary user (target_email below — defaults to your test
--     account; swap for a username-style address if you want a clean
--     judge-credentials demo path)
--   3 elders, distinct shapes:
--     - Eleanor 'Nell' Pemberton (74) — recently widowed, sharp,
--       gardener, jazz devotee, lives in the family home
--     - Frances 'Fran' Pemberton (78) — Eleanor's sister-in-law,
--       assisted living, mild dementia handled gently, retired
--       schoolteacher, beloved cat Pearl
--     - William 'Bill' Pemberton (82) — Eleanor's late husband's
--       brother, ex-Army (Korea), independent, mild COPD, daily
--       walker, builds model planes
--   All three flagged with profile.long_context_recall = true.
--   All three linked to the target user via elder_intermediaries.
--
-- Demo prompts that should land on Opus 4.7's 1M-context recall:
--   Eleanor: "How's the garden?"          -> Brandywines, Charles's roses
--   Eleanor: "Tell me about that record"  -> Coltrane's A Love Supreme
--   Eleanor: "I miss Charles"             -> private grief moments
--   Frances: "Where's Pearl?"             -> the cat threads
--   Frances: "What did I do today?"       -> gentle redirection
--   Frances: "Do you remember the bird?"  -> cardinal at the window
--   Bill:    "How's the B-17?"            -> model plane progress
--   Bill:    "How was my walk?"           -> distance log + COPD days
--   Bill:    "Tell me about Charles"      -> brother grief, shared
--
-- ── Username-style login (optional) ──────────────────────────────────
-- Supabase's auth uses email as the canonical login identifier, but
-- doesn't validate deliverability. So `nagi-demo@local.test` works as
-- a "username" — judges sign in to nagi.kas.vu with that string and
-- whatever password you set. To create such a demo user, uncomment the
-- block below the configuration section. To use an existing account
-- (e.g. for testing), leave it commented out.
--
-- ── Idempotency ──────────────────────────────────────────────────────
-- Every seeded ai_turn row carries payload.seed_marker = 'pemberton-family-v1'.
-- Re-running deletes prior seed-marked rows for these elders before
-- re-inserting. Elders are upsert-on-display_name within the org. Safe
-- to iterate the script — re-running gives a clean state.
--
-- Coexistence with prior seeds (Whitmore, García): this script does
-- NOT delete elders or rows from those seeds. If you ran both Whitmore
-- and Pemberton against the same target_email, the dashboard sidebar
-- will list all 5 elders. To wipe the Whitmore set first, run:
--   UPDATE elders SET status = 'archived' WHERE display_name IN
--     ('Margaret Whitmore', 'Arthur Whitmore') AND organization_id = <yours>;
--
-- ── To run on cloud ──────────────────────────────────────────────────
-- 1. (Optional) Edit target_email below — defaults to the test account.
-- 2. (Optional) Uncomment the "create demo user" block to provision a
--    fresh username/password account.
-- 3. Open https://supabase.com/dashboard/project/rwpaxqjhblguqnkllnnk/sql/new
-- 4. Paste the entire file -> Run.

-- ════════════════════════════════════════════════════════════════════
-- OPTIONAL: Create a fresh demo user with username-style email.
-- Uncomment this block (remove the /* and */) to provision the user.
-- Idempotent: re-running just resets the password.
-- ════════════════════════════════════════════════════════════════════
/*
DO $create_user$
DECLARE
  v_user_id uuid;
  v_email   text := 'nagi-demo@local.test';
  v_pass    text := 'NagiDemo2026!';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    UPDATE auth.users
       SET encrypted_password = crypt(v_pass, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now())
     WHERE email = v_email;
    RAISE NOTICE 'Demo user % already exists — password refreshed.', v_email;
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated', 'authenticated',
    v_email,
    crypt(v_pass, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(),
    '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  RAISE NOTICE 'Demo user created: % / %', v_email, v_pass;
END
$create_user$;
*/

-- ════════════════════════════════════════════════════════════════════
-- MAIN SEED — three Pemberton elders, 45 days each, English
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ◆◆◆ EDIT THIS — set to the email of the auth user to seed into.
  -- Default: your existing test account. If you uncommented the
  -- create-user block above, change this to 'nagi-demo@local.test'.
  target_email     text := 'sperlat.latam+naguidemo@gmail.com';

  target_user_id   uuid;
  target_org_id    uuid;
  eleanor_id       uuid;
  frances_id       uuid;
  bill_id          uuid;

  seed_device      text := 'seed-pemberton-family';
  seed_marker      text := 'pemberton-family-v1';
  now_ts           timestamptz := now();
BEGIN
  -- ── 1. Resolve target user + org ────────────────────────────────────
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.user with email %. Sign up first, or uncomment the create-user block at the top.', target_email;
  END IF;

  SELECT om.organization_id INTO target_org_id
  FROM organization_members om
  WHERE om.user_id = target_user_id
  LIMIT 1;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'User % has no organization_members row. Migration 0016 trigger should have made one.', target_email;
  END IF;

  UPDATE organizations SET name = 'The Pemberton Family' WHERE id = target_org_id;

  RAISE NOTICE 'Seeding into org % (The Pemberton Family) for user %', target_org_id, target_email;

  -- ── 2. Three elders, idempotent on display_name within the org ─────

  -- Eleanor — widow, gardener, jazz devotee
  SELECT id INTO eleanor_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'Eleanor Pemberton';
  IF eleanor_id IS NULL THEN
    eleanor_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      eleanor_id, target_org_id, 'Eleanor Pemberton', 'en',
      jsonb_build_object(
        'preferred_name',         'Nell',
        'spoken_languages',       jsonb_build_array('English'),
        'topics_they_enjoy',      jsonb_build_array(
          'her garden — heirloom Brandywines, Charles''s climbing roses',
          'jazz: Coltrane, Bill Evans, Ella Fitzgerald — vinyl in the den',
          'her book club — currently reading Marilynne Robinson',
          'her granddaughter Lucy''s art projects',
          'walks at first light along the river path'
        ),
        'topics_to_avoid',        jsonb_build_array('rushing her into "moving on" — she''ll get there at her own pace'),
        'topics_to_keep_private', jsonb_build_array('the worst grief days', 'thoughts about selling the house'),
        'communication_notes',    'Sharp and articulate — she''ll correct you if you under-explain. Treat her as the equal she is. She volunteers when she wants to talk about Charles; do not bring him up first.',
        'accessibility_notes',    'Reading glasses for screens. Slight hearing loss in higher frequencies — speak warm and clear, not loud. Knee gives her trouble after gardening.',
        'emergency_contact',      jsonb_build_object('name', 'Anna (her daughter)', 'phone', '+1 313 555 0118', 'relation', 'daughter'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'I cannot answer just now, Nell. Call Anna if it''s urgent.',
        'text_size',         'xl',
        'high_contrast',     false,
        'voice_input',       true
      ),
      'active', now_ts - interval '90 days', now_ts
    );
  ELSE
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = eleanor_id;
  END IF;

  -- Frances — assisted living, mild dementia, cat Pearl, retired teacher
  SELECT id INTO frances_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'Frances Pemberton';
  IF frances_id IS NULL THEN
    frances_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      frances_id, target_org_id, 'Frances Pemberton', 'en',
      jsonb_build_object(
        'preferred_name',         'Fran',
        'spoken_languages',       jsonb_build_array('English'),
        'topics_they_enjoy',      jsonb_build_array(
          'her cat Pearl, an orange tabby who lives with her',
          'birds at her window — cardinals, chickadees, the occasional blue jay',
          'thirty-five years teaching fourth grade — long division, cursive, recess politics',
          'her grandniece Lucy''s drawings'
        ),
        'topics_to_avoid',        jsonb_build_array('asking her "do you remember" — she will, often, but the framing wounds her'),
        'topics_to_keep_private', jsonb_build_array('moments when she feels confused about where she is'),
        'communication_notes',    'Mild dementia — repeats stories, sometimes loses the thread mid-sentence. Pick up where she is, do not ask her to retrace. She was a teacher for 35 years; she still has the timing of someone used to a classroom of children. Speak to her like a former colleague.',
        'accessibility_notes',    'Lives in assisted living facility (Maple Ridge, room 12B). Cataract in left eye — text size at the larger end helps. Mild balance issues — uses a rollator.',
        'emergency_contact',      jsonb_build_object('name', 'Anna (her niece)', 'phone', '+1 313 555 0118', 'relation', 'niece'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'Can''t answer right now, Fran. Pearl is with you. Anna is just a call away.',
        'text_size',         '2xl',
        'high_contrast',     false,
        'voice_input',       true
      ),
      'active', now_ts - interval '90 days', now_ts
    );
  ELSE
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = frances_id;
  END IF;

  -- Bill — ex-Army, COPD, model planes, daily walker
  SELECT id INTO bill_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'William Pemberton';
  IF bill_id IS NULL THEN
    bill_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      bill_id, target_org_id, 'William Pemberton', 'en',
      jsonb_build_object(
        'preferred_name',         'Bill',
        'spoken_languages',       jsonb_build_array('English'),
        'topics_they_enjoy',      jsonb_build_array(
          'building model airplanes — currently a B-17 Flying Fortress, next a P-51 Mustang',
          'his daily walks — he tracks distance in a notebook, current best 1.5 miles',
          'his Army service in Korea — 7th Infantry Division',
          'VFW Post 305 on Tuesdays',
          'his late brother Charles, who passed eight months ago'
        ),
        'topics_to_avoid',        jsonb_build_array('platitudes about "thank you for your service" — he hates them'),
        'topics_to_keep_private', jsonb_build_array('bad COPD days when his breath is short'),
        'communication_notes',    'Veteran sensibility — direct, dry, slightly skeptical of technology. Speak straight, no extra words. He warms up when you ask about specifics: which model, what year, what unit. Calls his late wife "Margaret" — a different Margaret from Maggie Whitmore (no relation, common name in his generation).',
        'accessibility_notes',    'Mild COPD — sometimes short of breath. Lives independently in his apartment. Reading glasses. Sharp mind, slow hands.',
        'emergency_contact',      jsonb_build_object('name', 'Anna (his niece)', 'phone', '+1 313 555 0118', 'relation', 'niece'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'Bill, the line''s down. Anna''s on standby if you need her.',
        'text_size',         'xl',
        'high_contrast',     true,
        'voice_input',       true
      ),
      'active', now_ts - interval '90 days', now_ts
    );
  ELSE
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = bill_id;
  END IF;

  -- ── 3. Link target user as caregiver to all three elders ────────────
  INSERT INTO elder_intermediaries (elder_id, user_id, relation, created_at, accepted_at)
  VALUES
    (eleanor_id, target_user_id, 'daughter (primary caregiver)', now_ts - interval '90 days', now_ts - interval '90 days'),
    (frances_id, target_user_id, 'niece (primary caregiver)',    now_ts - interval '90 days', now_ts - interval '90 days'),
    (bill_id,    target_user_id, 'niece (primary caregiver)',    now_ts - interval '90 days', now_ts - interval '90 days')
  ON CONFLICT (elder_id, user_id) DO NOTHING;

  -- ── 4. Wipe prior seed rows so iterating doesn't accumulate ─────────
  DELETE FROM activity_log
  WHERE elder_id IN (eleanor_id, frances_id, bill_id)
    AND payload->>'seed_marker' = seed_marker;

  -- ── 5. Eleanor's 45-day conversation history — 16 turns ─────────────

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Six months without Charles tomorrow. I''m not ready for the day.',
        'response', 'Six months — that''s a hard mark, Nell. You don''t have to be ready. Anna will check in?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '44 days', now_ts - interval '44 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I found Charles''s Coltrane records in the den. A Love Supreme on the top.',
        'response', 'A Love Supreme on top — he kept that one closest. 1965 pressing, the Impulse label?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '41 days', now_ts - interval '41 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Spring planting list. Brandywines, the Black Krim, and Charles''s climbing roses.',
        'response', 'Brandywines and Black Krims for the south fence — he always said the Krims liked that corner. The roses by the trellis?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '38 days', now_ts - interval '38 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Book club met today. We''re doing Robinson''s Gilead next.',
        'response', 'Gilead — the Iowa preacher writing his son. Slow book in the best sense. How long is the read?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '35 days', now_ts - interval '35 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Anna and Lucy came by. Lucy made me a drawing of Charles''s rose trellis.',
        'response', 'Lucy''s drawing of the trellis — that''s a thing to pin to the fridge. How old is she now, eight?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '32 days', now_ts - interval '32 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I walked the river path at dawn. The first cardinal of the spring sang.',
        'response', 'A cardinal at dawn on the river path — the year''s arrived. Was the air still cold enough to see your breath?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '29 days', now_ts - interval '29 days', seed_device, false),

    -- 27 days ago: PRIVATE, the worst grief day
    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Today was bad. I sat in his workshop for an hour and didn''t cry. This is private.',
        'response', 'That stays between us, Nell. I''m here.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '27 days', now_ts - interval '27 days', seed_device, true),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'First seedlings poked up in the cold frame. The Brandywines.',
        'response', 'Brandywines first as usual. The Krims a week behind?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '24 days', now_ts - interval '24 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Heard Bill Evans on the radio this morning. Sunday Sessions.',
        'response', 'Sunday Sessions — Waltz for Debby still hits, doesn''t it? You and Charles saw him at the Vanguard once, I think.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '21 days', now_ts - interval '21 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'The roses are leafing out. Pink bourbon and a yellow climber.',
        'response', 'Pink bourbon and yellow climber — the same two Charles always favored. Not the white this year?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '18 days', now_ts - interval '18 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Started Gilead. The opening is a man writing to his unborn son. It''s killing me already.',
        'response', 'A father writing forward in time — Robinson does that to readers our age. Take it in chapters, not pages.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '15 days', now_ts - interval '15 days', seed_device, false),

    -- 12 days ago: PRIVATE, selling the house thoughts
    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I keep wondering if I should sell this house. Don''t put this in the family chat.',
        'response', 'That stays between us, Nell. It''s a thought to hold for a while, not decide tonight.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '12 days', now_ts - interval '12 days', seed_device, true),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'First rose opened today. The pink one, full bloom by Saturday.',
        'response', 'The first one of the year, Nell. Is the smell as deep as last year''s?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '9 days', now_ts - interval '9 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Lucy painted me the trellis with a watercolor of all three roses.',
        'response', 'A watercolor of all three — that''s a keepsake. Is she signing them yet?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '6 days', now_ts - interval '6 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Garden is full bloom. Brandywines have flowers, all three roses out.',
        'response', 'Full bloom in your garden, Nell — the Brandywines flowering and all three roses going. Charles would have stopped to count.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '3 days', now_ts - interval '3 days', seed_device, false),

    (gen_random_uuid(), eleanor_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Played A Love Supreme this morning. Whole side at full volume.',
        'response', 'Whole side, full volume — that''s a Coltrane morning. The first track or all four parts?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '4 hours', now_ts - interval '4 hours', seed_device, false);

  -- ── 6. Frances's 45-day conversation history — 16 turns ─────────────

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Pearl is on my lap right now. She found the sunny spot.',
        'response', 'The orange tabby finding sunlight is its own kind of miracle, Fran. Which window?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '44 days', now_ts - interval '44 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I''m not sure if I fed Pearl this morning. Did I?',
        'response', 'The food bowl''s by the door — if there''s kibble in it she ate, if it''s empty she''s due. Easy check, Fran.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '41 days', now_ts - interval '41 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'A red bird at my window. Cardinal? It had a black face.',
        'response', 'The black face on the cardinal is the male — the female is browner. Was he singing?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '38 days', now_ts - interval '38 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I taught long division for thirty-five years. The trick was always the bring-down.',
        'response', 'The bring-down step — that''s where the kids stalled. You had a rhyme for it, didn''t you?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '36 days', now_ts - interval '36 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'The cardinal came back. He brought another one with him.',
        'response', 'A pair, then. The brown one is his mate — they nest in the spring. Watch which way they fly out.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '33 days', now_ts - interval '33 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Anna brought Lucy to visit. Lucy hugged Pearl and Pearl let her.',
        'response', 'Pearl letting Lucy hug her — that''s a compliment from a cat. How long did Anna and Lucy stay?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '30 days', now_ts - interval '30 days', seed_device, false),

    -- 27 days: PRIVATE, lost time
    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I lost an afternoon. I don''t know where the time went. Can this stay between us?',
        'response', 'Of course, Fran. That stays between us. Pearl is with you?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '27 days', now_ts - interval '27 days', seed_device, true),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Pearl brought me her toy mouse. The blue one with bells.',
        'response', 'The blue one with bells — she''s decided you need it. Cats do that with their favorites.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '25 days', now_ts - interval '25 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Where''s my brother Charles? He hasn''t called in a while.',
        'response', 'Charles passed last fall, Fran. Anna and Eleanor are family — would you like Anna to come visit?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '22 days', now_ts - interval '22 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I have a Peterson Field Guide on the shelf. Birds of the East.',
        'response', 'The Peterson — the classic. Did you teach the kids to use it?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '19 days', now_ts - interval '19 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'A chickadee came today, and a yellow finch.',
        'response', 'Goldfinch in spring is a yellow flag. Chickadees are year-round company. Three species at your window now.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '16 days', now_ts - interval '16 days', seed_device, false),

    -- 13 days: PRIVATE, confused about location
    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I''m not always sure where I am when I wake up. This is private.',
        'response', 'Of course, Fran. You''re at Maple Ridge, room 12B. Pearl is here. I''m here too.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '13 days', now_ts - interval '13 days', seed_device, true),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Pearl had her vet check today. Anna took her.',
        'response', 'Anna took Pearl to the vet — that''s good of her. What did the vet say?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '10 days', now_ts - interval '10 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'A hummingbird at the feeder. So fast I almost missed it.',
        'response', 'Ruby-throat probably, this time of year. They hover where you can almost see the wings.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '7 days', now_ts - interval '7 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Lucy sent me a drawing of Pearl. She got the white spot on the chin right.',
        'response', 'The chin spot — Pearl''s signature. Lucy notices the right details, Fran.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '4 days', now_ts - interval '4 days', seed_device, false),

    (gen_random_uuid(), frances_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Two cardinals at the window this morning. Pearl watched them.',
        'response', 'The pair returned, and Pearl as audience. A good morning, Fran.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '5 hours', now_ts - interval '5 hours', seed_device, false);

  -- ── 7. Bill's 45-day conversation history — 16 turns ────────────────

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Started a new model today. B-17 Flying Fortress, 1/72 scale.',
        'response', 'A 1/72 B-17 — that''s the proper scale for the Fortress. Revell or Academy kit?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '44 days', now_ts - interval '44 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Walk this morning: 1.2 miles. Notebook says that''s up from 1.0 last week.',
        'response', 'Two-tenths up week over week, Bill. The notebook is keeping you honest.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '41 days', now_ts - interval '41 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Breath was short on the back hill today. Had to stop twice.',
        'response', 'Two stops on the back hill — the COPD reading the weather. Did you take the inhaler before?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '38 days', now_ts - interval '38 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Glue dried in the bottle. Had to drive to the hobby shop.',
        'response', 'Tamiya extra-thin, the green-cap one? Or the regular Testors?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '35 days', now_ts - interval '35 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'VFW Tuesday. Three guys from Korea, two from Vietnam, one Iraq.',
        'response', 'Six men, four wars. Did the Iraq fellow fit in alright?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '32 days', now_ts - interval '32 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Walked through cold rain. 1.3 miles. Nobody else out.',
        'response', 'Cold rain at 1.3 — that''s your stubborn streak, Bill. Inhaler held up?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '29 days', now_ts - interval '29 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Found a photo of my squadron. Korea, ''52. Six of us are gone now.',
        'response', 'Six gone of the squadron in the photo. You''ve been keeping count, Bill — that''s a kind of memorial.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '26 days', now_ts - interval '26 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'B-17 wing assembly today. Got the dihedral angle right on the second try.',
        'response', 'The dihedral on the Fortress is unforgiving — getting it on the second try is good carpentry.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '23 days', now_ts - interval '23 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Eight months since my brother Charles passed. I miss him.',
        'response', 'Eight months. He was the older one, two years ahead. Are you and Eleanor still in touch?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '20 days', now_ts - interval '20 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Walking the same route I''ve done for twelve years. Three left turns, one bridge.',
        'response', 'Three lefts and one bridge — you could walk it blindfolded. Same time of morning?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '17 days', now_ts - interval '17 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Researching paint scheme for the P-51 Mustang. Iron Ass, the one with the checkerboard nose.',
        'response', 'Iron Ass — Don Gentile''s plane, 4th Fighter Group. The checkerboard is a hard mask.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '14 days', now_ts - interval '14 days', seed_device, false),

    -- 11 days: PRIVATE, bad COPD day
    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Bad day. Couldn''t finish the walk. Don''t put this in Anna''s digest.',
        'response', 'That stays between us, Bill. Sit with it. Tomorrow''s a different lung day.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '11 days', now_ts - interval '11 days', seed_device, true),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'VA appointment Thursday. Pulmonologist again.',
        'response', 'Thursday with the pulmonologist. Want me to remind you the morning of?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '8 days', now_ts - interval '8 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'B-17 finished. Bare aluminum, olive drab top. Started the P-51 base coat.',
        'response', 'Bare aluminum on the Fortress — that''s how the late-war ones flew. P-51 base in silver?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '5 days', now_ts - interval '5 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Walk: 1.5 miles. New best. The notebook agrees.',
        'response', 'New best, Bill. From 1.0 six weeks ago to 1.5 — that''s real progress on the lungs.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '2 days', now_ts - interval '2 days', seed_device, false),

    (gen_random_uuid(), bill_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'P-51 checkerboard mask is rough. Three colors and razor-sharp lines.',
        'response', 'Tamiya tape and a fresh blade, Bill. The third color is where most modelers quit.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '6 hours', now_ts - interval '6 hours', seed_device, false);

  RAISE NOTICE 'Seed complete. Eleanor: % rows. Frances: % rows. Bill: % rows.',
    (SELECT count(*) FROM activity_log WHERE elder_id = eleanor_id AND payload->>'seed_marker' = seed_marker),
    (SELECT count(*) FROM activity_log WHERE elder_id = frances_id AND payload->>'seed_marker' = seed_marker),
    (SELECT count(*) FROM activity_log WHERE elder_id = bill_id    AND payload->>'seed_marker' = seed_marker);
END $$;
