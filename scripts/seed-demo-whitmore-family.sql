-- Demo seed: The Whitmore Family
-- ──────────────────────────────
-- English-language counterpart to the Familia García seed. Same
-- multi-elder-under-one-tenant structure, different cast and arcs so
-- a demo evaluator who runs both can see the model isn't bound to one
-- language or one family shape.
--
-- Tenancy story:
--   1 organization (The Whitmore Family)
--   1 intermediary user (configured at the top — change target_email)
--   2 elders:
--     - Margaret "Maggie" Whitmore (76, retired librarian, recent hip
--       replacement, crossword-puzzle-and-PBS-mystery devotee,
--       grandkids Emma in college and Henry)
--     - Arthur Whitmore (79, Maggie's husband, retired English teacher,
--       lifelong gardener of heirloom tomatoes and climbing roses,
--       mild memory issues, recently lost his sister Beatrice)
--   Both flagged with profile.long_context_recall = true.
--   Both linked to the target user via elder_intermediaries.
--
-- Demo prompts that should land on Opus 4.7's 1M-context recall:
--   Maggie: "How's my hip feeling?"       -> recalls surgery + PT progress
--   Maggie: "Anything good on TV?"        -> recalls Endeavour plot beats
--   Maggie: "Tell me about Emma"          -> recalls granddaughter's college
--   Arthur: "How's the garden?"           -> recalls roses + tomatoes
--   Arthur: "What did I do yesterday?"    -> recalls gently, no quiz
--   Arthur: "I miss Beatrice"             -> private moment thread
--
-- Idempotency: every seeded ai_turn carries payload.seed_marker
-- = 'whitmore-family-v1'. Re-running deletes prior seed-marked rows
-- before re-inserting; elders are upsert-on-display_name within the org.
--
-- To run on cloud:
--   1. Edit target_email below to match the new account you signed up.
--   2. Open https://supabase.com/dashboard/project/rwpaxqjhblguqnkllnnk/sql/new
--   3. Paste the whole file -> Run.

DO $$
DECLARE
  -- ◆◆◆ EDIT THIS — set to the email of the auth user you want to seed into.
  target_email     text := 'demo-en@nagi.test';

  target_user_id   uuid;
  target_org_id    uuid;
  maggie_id        uuid;
  arthur_id        uuid;

  seed_device      text := 'seed-whitmore-family';
  seed_marker      text := 'whitmore-family-v1';
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

  -- Rename the org for the demo. Idempotent.
  UPDATE organizations SET name = 'The Whitmore Family' WHERE id = target_org_id;

  RAISE NOTICE 'Seeding into org % (The Whitmore Family) for user %', target_org_id, target_email;

  -- ── 2. Two elders, idempotent on display_name within the org ───────

  -- Maggie — post-hip-replacement, libraries, crosswords, PBS Masterpiece
  SELECT id INTO maggie_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'Margaret Whitmore';
  IF maggie_id IS NULL THEN
    maggie_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      maggie_id, target_org_id, 'Margaret Whitmore', 'en',
      jsonb_build_object(
        'preferred_name',         'Maggie',
        'spoken_languages',       jsonb_build_array('English'),
        'topics_they_enjoy',      jsonb_build_array(
          'her grandchildren Emma and Henry',
          'crossword puzzles (Sunday Times especially)',
          'PBS Masterpiece — Endeavour, Grantchester',
          'her years at the Detroit Public Library',
          'her dog Biscuit, a cocker spaniel'
        ),
        'topics_to_avoid',        jsonb_build_array('her late father — she rarely talks about him'),
        'topics_to_keep_private', jsonb_build_array('worries about money', 'days she feels frail'),
        'communication_notes',    'Sharp mind, independent. Treat her like the librarian she was — she can find her own answers if you point her at them. Do NOT speak slowly or pat her along. She likes specifics: dates, page numbers, episode titles.',
        'accessibility_notes',    'Hip replacement four weeks ago — still with a cane. Reading glasses for screens. Hard of hearing in the left ear; speak toward the right side.',
        'emergency_contact',      jsonb_build_object('name', 'Sarah (her daughter)', 'phone', '+1 313 555 0142', 'relation', 'daughter'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'I cannot answer just now, Maggie. Call Sarah if it''s urgent.',
        'text_size',         'xl',
        'high_contrast',     false,
        'voice_input',       true
      ),
      'active', now_ts - interval '60 days', now_ts
    );
  ELSE
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = maggie_id;
  END IF;

  -- Arthur — retired English teacher, gardener, mild memory issues, recent grief
  SELECT id INTO arthur_id FROM elders
   WHERE organization_id = target_org_id AND display_name = 'Arthur Whitmore';
  IF arthur_id IS NULL THEN
    arthur_id := gen_random_uuid();
    INSERT INTO elders (
      id, organization_id, display_name, preferred_lang,
      profile, profile_version, ui_config, status, created_at, updated_at
    ) VALUES (
      arthur_id, target_org_id, 'Arthur Whitmore', 'en',
      jsonb_build_object(
        'preferred_name',         'Arthur',
        'spoken_languages',       jsonb_build_array('English'),
        'topics_they_enjoy',      jsonb_build_array(
          'his garden — heirloom tomatoes (Brandywine, Cherokee Purple) and climbing roses',
          'teaching high school English for 38 years — Hamlet, To Kill a Mockingbird',
          'walking the dog Biscuit at dawn',
          'letters to his granddaughter Emma at college'
        ),
        'topics_to_avoid',        jsonb_build_array('his sister Beatrice''s recent passing — wait for him to mention her first'),
        'topics_to_keep_private', jsonb_build_array('moments when he feels lost or confused'),
        'communication_notes',    'Mild short-term memory issues — repeat important things in different words, do not ask "don''t you remember?". He prefers being treated as the teacher he was, not as a forgetful old man. He notices when he''s being patronized.',
        'accessibility_notes',    'Hearing aid in the left ear. Slight tremor in his right hand — gives him trouble with small touch targets. Reading glasses for close work.',
        'emergency_contact',      jsonb_build_object('name', 'Sarah (his daughter)', 'phone', '+1 313 555 0142', 'relation', 'daughter'),
        'long_context_recall',    true
      ),
      1,
      jsonb_build_object(
        'home_cards',        jsonb_build_array('call_family', 'get_help', 'my_day', 'one_task'),
        'offline_message',   'Can''t answer right now, Arthur. Call Sarah if you need her.',
        'text_size',         '2xl',
        'high_contrast',     true,
        'voice_input',       true
      ),
      'active', now_ts - interval '60 days', now_ts
    );
  ELSE
    UPDATE elders SET profile = profile || jsonb_build_object('long_context_recall', true)
     WHERE id = arthur_id;
  END IF;

  -- ── 3. Link target user as caregiver to both elders ─────────────────
  INSERT INTO elder_intermediaries (elder_id, user_id, relation, created_at, accepted_at)
  VALUES
    (maggie_id, target_user_id, 'daughter (primary caregiver)', now_ts - interval '60 days', now_ts - interval '60 days'),
    (arthur_id, target_user_id, 'daughter (primary caregiver)', now_ts - interval '60 days', now_ts - interval '60 days')
  ON CONFLICT (elder_id, user_id) DO NOTHING;

  -- ── 4. Wipe prior seed rows so iterating doesn't accumulate ─────────
  DELETE FROM activity_log
  WHERE elder_id IN (maggie_id, arthur_id)
    AND payload->>'seed_marker' = seed_marker;

  -- ── 5. Maggie's 30-day conversation history ─────────────────────────
  -- 14 turns. Threads the demo can recall:
  --   - Hip replacement 4 weeks ago, recovery progress
  --   - Watching Endeavour, missing-student plot
  --   - Granddaughter Emma at University of Michigan
  --   - Dog Biscuit, daily walks
  --   - Sunday Times crossword
  --   - One private moment about money worries

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    -- 28 days ago: pre-surgery
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Tomorrow''s the hip surgery. I''m not sleeping well.',
        'response', 'Maggie, the night before is the hardest part. Sarah will be there when you wake up. Dr. Chen does this surgery every week — by tomorrow night the hard part is behind you. Want to talk about something else for a bit?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '28 days', now_ts - interval '28 days', seed_device, false),

    -- 25 days ago: post-op week one
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'The hip aches when I stand up. Is that normal?',
        'response', 'A few days after a hip replacement the standing-up moment is the hardest. The fact that you''re moving with the walker is what Dr. Chen wants to see. Are you keeping up with the pain medication on schedule?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '25 days', now_ts - interval '25 days', seed_device, false),

    -- 22 days ago: Endeavour
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Did you watch Endeavour last night? The student went missing.',
        'response', 'I didn''t watch it, but tell me. It''s the Oxford one again, isn''t it? Do you think it''s the tutor or the boyfriend?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '22 days', now_ts - interval '22 days', seed_device, false),

    -- 20 days ago: Emma at college
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Emma called from Ann Arbor. She got a B+ on her literature paper.',
        'response', 'University of Michigan grading B+ feels like an A elsewhere. What was the paper on?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '20 days', now_ts - interval '20 days', seed_device, false),

    -- 18 days ago: walking with cane
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Today I walked to the kitchen with just the cane. No walker.',
        'response', 'Maggie, that''s a real milestone. Less than two weeks past surgery and you''re on the cane. Sarah will be glad to hear it.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '18 days', now_ts - interval '18 days', seed_device, false),

    -- 15 days ago: Biscuit the dog
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Biscuit has been sleeping at the foot of the bed since the surgery.',
        'response', 'Cocker spaniels read their people. Biscuit knows you''re mending — she''s standing watch. Is she getting her morning walk yet, or is Sarah taking her?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '15 days', now_ts - interval '15 days', seed_device, false),

    -- 12 days ago: Endeavour plot reveal
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'You were close — it was the tutor, not the boyfriend. The girl is alive.',
        'response', 'Ha — close but not quite. You called the tutor weeks ago, didn''t you? You''ve always had a feel for which character is too composed.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '12 days', now_ts - interval '12 days', seed_device, false),

    -- 10 days ago: crossword
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I finished the Sunday crossword in under an hour today. First time in months.',
        'response', 'Under an hour on a Sunday — that''s the librarian Maggie back. The hip kept your body busy; the brain was waiting.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '10 days', now_ts - interval '10 days', seed_device, false),

    -- 8 days ago: Emma visit announcement
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Emma''s coming home from Ann Arbor next weekend. Spring break.',
        'response', 'A whole week with Emma. Will she stay at the house or with friends in town?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '8 days', now_ts - interval '8 days', seed_device, false),

    -- 6 days ago: physical therapy progress
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'My PT said I''m three weeks ahead of where most patients are.',
        'response', 'Maggie, four weeks out and three ahead of schedule — that''s because you do the boring exercises every day, not just when she watches.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '6 days', now_ts - interval '6 days', seed_device, false),

    -- 4 days ago: PRIVATE — money worry
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'The hospital bill came. It''s more than I expected. This stays between us, please.',
        'response', 'That stays between us, Maggie. I''m here.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '4 days', now_ts - interval '4 days', seed_device, true),

    -- 3 days ago: Endeavour finale
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Endeavour finale was last night. They wrapped up the Oxford case.',
        'response', 'Did the girl forgive the tutor in the end? You said that was the question that mattered.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '3 days', now_ts - interval '3 days', seed_device, false),

    -- Yesterday: Biscuit walk
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I walked Biscuit around the block today. First time since the surgery.',
        'response', 'Around the whole block, Maggie. Four weeks ago you couldn''t stand up without help. Biscuit must be relieved to have you back on the leash.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '1 day', now_ts - interval '1 day', seed_device, false),

    -- This morning: Emma incoming
    (gen_random_uuid(), maggie_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Emma''s flight gets in tonight at seven.',
        'response', 'A week with your granddaughter starts tonight. Anything you''re hoping to do together — a movie, a meal, the bookstore?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '6 hours', now_ts - interval '6 hours', seed_device, false);

  -- ── 6. Arthur's 30-day conversation history ─────────────────────────
  -- 13 turns. Threads:
  --   - Beatrice's recent passing handled gently
  --   - Heirloom tomatoes (Brandywine, Cherokee Purple) and climbing roses
  --   - Letters to Emma at college
  --   - Memory slips → soft redirection
  --   - Biscuit walks at dawn
  --   - Hamlet / English-teacher recall

  INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
  VALUES
    -- 27 days ago: Beatrice, voluntarily
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'It would''ve been Beatrice''s 81st birthday today.',
        'response', 'Eighty-one, Arthur. Your sister, two years older. Do you want to tell me something about her?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '27 days', now_ts - interval '27 days', seed_device, false),

    -- 24 days ago: tomatoes
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I put in the Brandywines this morning. Six plants. Same row as last year.',
        'response', 'Brandywines on the south fence — that''s the spot Beatrice always told you they liked. Are you doing Cherokee Purples again too?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '24 days', now_ts - interval '24 days', seed_device, false),

    -- 21 days ago: dawn walk
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Walked Biscuit at dawn again. The light through the maples was something.',
        'response', 'Dawn light through the maples — that sounds like the kind of thing you''d have written about for the school paper. Did you keep a journal of these walks?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '21 days', now_ts - interval '21 days', seed_device, false),

    -- 18 days ago: roses
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'The climbing roses are getting their first leaves out. Beatrice helped me plant those.',
        'response', 'The roses by the trellis — she came over the spring of ninety-six, didn''t she. Eight years from leaves to first bloom.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '18 days', now_ts - interval '18 days', seed_device, false),

    -- 15 days ago: memory slip handled
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Did I tell you about the roses yesterday? I can''t remember if I did.',
        'response', 'You told me something about the climbing ones getting their first leaves out — Beatrice''s. Tell me about the garden today.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '15 days', now_ts - interval '15 days', seed_device, false),

    -- 13 days ago: Emma letter
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'I''m writing Emma a letter. About the books I read at her age.',
        'response', 'A letter from her grandfather the English teacher about the books he read at twenty. That''s the kind of thing she''ll keep, Arthur.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '13 days', now_ts - interval '13 days', seed_device, false),

    -- 11 days ago: PRIVATE — feeling lost
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Some days I lose the thread of where I am. This is private, please.',
        'response', 'That stays between us, Arthur. I''m here.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '11 days', now_ts - interval '11 days', seed_device, true),

    -- 9 days ago: Hamlet
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Emma asked which Hamlet line I''d save if I could only keep one.',
        'response', 'A worthy question for an English teacher''s granddaughter. Which one did you tell her?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '9 days', now_ts - interval '9 days', seed_device, false),

    -- 7 days ago: Sarah visit
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Sarah came Sunday. I showed her the new tomato cages.',
        'response', 'The ones you welded yourself out of rebar? Did she find them as ridiculous as Beatrice always did?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '7 days', now_ts - interval '7 days', seed_device, false),

    -- 5 days ago: tomatoes growing
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'The Brandywines have flowers already. Two weeks earlier than last year.',
        'response', 'Two weeks early — was it the warmer March, or the compost you started in February?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '5 days', now_ts - interval '5 days', seed_device, false),

    -- 3 days ago: Biscuit
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Biscuit chased a rabbit out of the rose bed this morning.',
        'response', 'The cocker spaniel earning her keep, Arthur. Did the rabbit get any leaves?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '3 days', now_ts - interval '3 days', seed_device, false),

    -- Yesterday: memory slip, gentle
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'What did I do yesterday? I want to put it in my notebook.',
        'response', 'Yesterday Biscuit chased a rabbit out of your rose bed, and the Brandywine tomatoes were two weeks early on their flowers. That''s a good day to write down.',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '1 day', now_ts - interval '1 day', seed_device, false),

    -- This morning: Emma visit incoming
    (gen_random_uuid(), arthur_id, target_org_id, 'ai_turn',
      jsonb_build_object(
        'message',  'Emma''s coming home tonight. From Ann Arbor.',
        'response', 'A week with your granddaughter, Arthur. Will you give her the letter you wrote about the books?',
        'model',    'claude-opus-4-7',
        'seed_marker', seed_marker
      ),
      now_ts - interval '5 hours', now_ts - interval '5 hours', seed_device, false);

  RAISE NOTICE 'Seed complete. Maggie: % rows. Arthur: % rows.',
    (SELECT count(*) FROM activity_log WHERE elder_id = maggie_id AND payload->>'seed_marker' = seed_marker),
    (SELECT count(*) FROM activity_log WHERE elder_id = arthur_id AND payload->>'seed_marker' = seed_marker);
END $$;
