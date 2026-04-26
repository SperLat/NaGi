-- Demo seed: Pemberton archive — past weekly digests + extended moments
-- ────────────────────────────────────────────────────────────────────
-- Layered on top of seed-demo-pemberton-features.sql. Adds:
--   - 4 pre-canned weekly digests per Pemberton elder (covering the
--     past ~4 weeks) so the family-side "Past summaries" panel is
--     populated when a judge first lands.
--   - Extra proud moments going back ~10 weeks so the monthly summary
--     and the moments timeline have texture beyond the recent 14 days.
--
-- Each digest is hand-written in the brand voice (warm, honest, doesn't
-- repeat numbers, no emojis, weaves stats in only where helpful) so the
-- archive looks like Claude actually wrote them — because Claude WOULD
-- write something close to this given the same data.
--
-- Idempotent: deletes prior demo rows (period_end older than v_today,
-- moments occurred_on older than v_today - 14) before inserting. Safe
-- to re-run.
--
-- Run after seed-demo-pemberton-features.sql.

DO $$
DECLARE
  v_org_id     uuid;
  v_eleanor_id uuid;
  v_frances_id uuid;
  v_bill_id    uuid;
  v_user_id    uuid;
  v_today      date := CURRENT_DATE;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE name = 'The Pemberton Family' LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Pemberton org not found — run seed-demo-pemberton-family.sql first.';
  END IF;

  SELECT id INTO v_eleanor_id FROM elders WHERE organization_id = v_org_id AND display_name = 'Eleanor Pemberton';
  SELECT id INTO v_frances_id FROM elders WHERE organization_id = v_org_id AND display_name = 'Frances Pemberton';
  SELECT id INTO v_bill_id    FROM elders WHERE organization_id = v_org_id AND display_name = 'William Pemberton';
  SELECT user_id INTO v_user_id FROM elder_intermediaries WHERE elder_id = v_eleanor_id LIMIT 1;

  IF v_eleanor_id IS NULL OR v_frances_id IS NULL OR v_bill_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing prerequisites — run pemberton-family + pemberton-features first.';
  END IF;

  -- Wipe prior archive rows so re-runs are clean.
  DELETE FROM weekly_digests
   WHERE elder_id IN (v_eleanor_id, v_frances_id, v_bill_id)
     AND period_end < (v_today - 1)::timestamptz;
  DELETE FROM elder_moments
   WHERE elder_id IN (v_eleanor_id, v_frances_id, v_bill_id)
     AND occurred_on < v_today - 14
     AND occurred_on >= v_today - 90;

  -- ══════════════════════════════════════════════════════════════════
  -- WEEKLY DIGESTS — 4 weeks back per elder
  -- ══════════════════════════════════════════════════════════════════
  -- Each row: a recent past week, with markdown narrative aligned to
  -- the elder's profile and the moments seeded for that period.

  -- Eleanor — recent widow, gardener, jazz devotee
  INSERT INTO weekly_digests (organization_id, elder_id, period_start, period_end, digest_markdown, stats_json, created_at) VALUES
    (v_org_id, v_eleanor_id,
     (v_today - 7)::timestamptz, (v_today - 1)::timestamptz,
     E'## This week with Eleanor\n\nA quieter week than last. Eleanor stayed close to home and let the rain keep her in.\n\nShe pulled out Charles''s Coltrane records on Wednesday afternoon and listened through both sides without interruption — the first time she''s done that since spring. Sofia stopped by Friday with her dog, and they had tea while the sun broke through. Eleanor mentioned the climbing rose at the back wall is heavy with buds.\n\nNothing concerning to flag. If you''re calling this weekend, ask about the Brandywines — she said three came in heavier than last year.',
     '{"questions_asked": 14, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 6, "pill_skipped": 1, "pill_pending": 0}'::jsonb,
     (v_today - 1)::timestamptz),
    (v_org_id, v_eleanor_id,
     (v_today - 14)::timestamptz, (v_today - 8)::timestamptz,
     E'## This week with Eleanor\n\nA slow, steady week. Eleanor used Nagi most mornings, mostly to plan the day or check on the garden — she''s thinking about what to cut back before frost.\n\nShe asked once about a recipe she half-remembered for her mother''s sopa de fideo and walked through the steps with Nagi until she had it. She mentioned Maggie a few times this week and said she missed the river path.\n\nNo errors and no help requests. The medication routine looked steady all week.',
     '{"questions_asked": 18, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 7, "pill_skipped": 0, "pill_pending": 0}'::jsonb,
     (v_today - 8)::timestamptz),
    (v_org_id, v_eleanor_id,
     (v_today - 21)::timestamptz, (v_today - 15)::timestamptz,
     E'## This week with Eleanor\n\nGrief surfaced gently this week. Eleanor mentioned Charles in three different conversations — once about a record, once about the garden, once about a Sunday they used to have. She held the moments without spiraling.\n\nShe sent one help request when the kitchen tablet froze; you handled it within the hour. Otherwise the technology stayed out of her way.\n\nIf you''re thinking about a visit, this might be the week. She didn''t ask, but the warmth in her was reaching for company.',
     '{"questions_asked": 11, "errors": 1, "offline_unavailable": 0, "help_requests_total": 1, "help_requests_acknowledged": 1, "help_requests_pending": 0, "pill_taken": 7, "pill_skipped": 0, "pill_pending": 0}'::jsonb,
     (v_today - 15)::timestamptz),
    (v_org_id, v_eleanor_id,
     (v_today - 28)::timestamptz, (v_today - 22)::timestamptz,
     E'## This week with Eleanor\n\nA brisk, productive week. Eleanor finished the chapter she''d been on for two weeks and said the ending was kinder than she expected. The garden is mostly put up for the season — she''s pleased about that.\n\nShe asked Nagi a handful of small things, mostly logistics. No private moments this week, no flags.\n\nA gentle observation: she''s reading more lately. If you have a book she might like, this is a good time to bring it.',
     '{"questions_asked": 9, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 7, "pill_skipped": 0, "pill_pending": 0}'::jsonb,
     (v_today - 22)::timestamptz);

  -- Frances — mild dementia, retired schoolteacher, Pearl the cat
  INSERT INTO weekly_digests (organization_id, elder_id, period_start, period_end, digest_markdown, stats_json, created_at) VALUES
    (v_org_id, v_frances_id,
     (v_today - 7)::timestamptz, (v_today - 1)::timestamptz,
     E'## This week with Frances\n\nA tender week. Frances and Pearl spent most mornings in the chair by the window, and the cardinal was back two days running.\n\nShe told the story of her third-grade reading circle again on Tuesday — remembered every kid by name. The aide brought her toast cut into triangles like her mother used to make and Frances mentioned her mother three times that morning.\n\nThe evening melatonin was skipped twice. Not concerning at this baseline — she napped late on the days she missed.',
     '{"questions_asked": 22, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 12, "pill_skipped": 2, "pill_pending": 0}'::jsonb,
     (v_today - 1)::timestamptz),
    (v_org_id, v_frances_id,
     (v_today - 14)::timestamptz, (v_today - 8)::timestamptz,
     E'## This week with Frances\n\nFrances sang most of "Bringing in the Sheaves" without prompting on Wednesday — the aide said she hadn''t done that in months. She was bright that day.\n\nShe asked twice where Pearl was when Pearl was right next to her. Both times Nagi gently pointed and Frances laughed at herself. The conversations stayed warm.\n\nMorning meds were on time every day. The evening dose she let lapse three times — she went to bed early on those nights, which is its own kind of fine.',
     '{"questions_asked": 19, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 11, "pill_skipped": 3, "pill_pending": 0}'::jsonb,
     (v_today - 8)::timestamptz),
    (v_org_id, v_frances_id,
     (v_today - 21)::timestamptz, (v_today - 15)::timestamptz,
     E'## This week with Frances\n\nA cardinal landed on the windowsill Monday morning and Frances watched it for ten minutes before saying anything. Then she said: "I think I''ll write it down today, before I forget the color."\n\nShe asked Nagi for help spelling "vermilion" and they wrote a short note together. The aide put it in the kitchen drawer.\n\nNo flags. The week felt small and complete.',
     '{"questions_asked": 16, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 13, "pill_skipped": 1, "pill_pending": 0}'::jsonb,
     (v_today - 15)::timestamptz),
    (v_org_id, v_frances_id,
     (v_today - 28)::timestamptz, (v_today - 22)::timestamptz,
     E'## This week with Frances\n\nFrances had a harder Sunday — confused about which day it was, asked twice if her sister was visiting. By Monday she was steady again. The aide noted the pattern; nothing acute.\n\nThe rest of the week was Pearl, the cardinal, and a long afternoon of looking at old photographs. She named everyone in the 1957 reunion picture.\n\nIf you''re calling, she remembers Tuesday afternoons more reliably than mornings.',
     '{"questions_asked": 14, "errors": 0, "offline_unavailable": 0, "help_requests_total": 1, "help_requests_acknowledged": 1, "help_requests_pending": 0, "pill_taken": 12, "pill_skipped": 2, "pill_pending": 0}'::jsonb,
     (v_today - 22)::timestamptz);

  -- Bill — ex-Army Korea, model planes, daily walker
  INSERT INTO weekly_digests (organization_id, elder_id, period_start, period_end, digest_markdown, stats_json, created_at) VALUES
    (v_org_id, v_bill_id,
     (v_today - 7)::timestamptz, (v_today - 1)::timestamptz,
     E'## This week with Bill\n\nBill finished the wing assembly on the B-17 this week — said the rigging took longer than the airframe and laughed about it. He did the full block twice on Thursday. The COPD was quieter that day.\n\nThe neighbor''s grandson stopped by Friday and Bill walked him through every model on the shelf, told him which year each plane saw service. The kid was riveted.\n\nThe morning inhaler was taken every day. He skipped the evening dose twice — direct talk about it lands well; he''ll take the reminder when it''s framed practically.',
     '{"questions_asked": 8, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 12, "pill_skipped": 2, "pill_pending": 0}'::jsonb,
     (v_today - 1)::timestamptz),
    (v_org_id, v_bill_id,
     (v_today - 14)::timestamptz, (v_today - 8)::timestamptz,
     E'## This week with Bill\n\nA solid week of walking. Bill made it past the post-office bench twice, which he hasn''t done this month. He keeps a quiet log of his own; Nagi just helps when he asks for the date.\n\nHe told the story about Charles fixing a carburetor with a hairpin in ''68. Laughed at the part where they used the hairpin. He misses Charles steadily but doesn''t make a thing of it.\n\nNothing to flag. If you''re calling, the walks are the thing he''ll talk about.',
     '{"questions_asked": 6, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 14, "pill_skipped": 0, "pill_pending": 0}'::jsonb,
     (v_today - 8)::timestamptz),
    (v_org_id, v_bill_id,
     (v_today - 21)::timestamptz, (v_today - 15)::timestamptz,
     E'## This week with Bill\n\nWeather kept Bill in three days running. He used the time to sand the B-17 fuselage and watch the Korea documentary on PBS — said it got the chow hall almost right.\n\nHe asked Nagi about model paint thinner brands and they walked through the differences. He''s pleased to have someone who''ll actually answer that without changing the subject.\n\nMedications steady. No errors, no help requests.',
     '{"questions_asked": 7, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 14, "pill_skipped": 0, "pill_pending": 0}'::jsonb,
     (v_today - 15)::timestamptz),
    (v_org_id, v_bill_id,
     (v_today - 28)::timestamptz, (v_today - 22)::timestamptz,
     E'## This week with Bill\n\nBill walked the loop every day this week. New personal best for the month — to the bench past the post office and back without resting. The COPD was kind to him.\n\nHe started a new model: a P-51 Mustang. Said the canopy work is going to be the patience test.\n\nEvening inhaler skipped once. Veteran sensibility on the meds: he takes them when the day''s pace lets him; doesn''t fuss when it doesn''t.',
     '{"questions_asked": 5, "errors": 0, "offline_unavailable": 0, "help_requests_total": 0, "help_requests_acknowledged": 0, "help_requests_pending": 0, "pill_taken": 13, "pill_skipped": 1, "pill_pending": 0}'::jsonb,
     (v_today - 22)::timestamptz);

  -- ══════════════════════════════════════════════════════════════════
  -- EXTENDED MOMENTS — going back ~10 weeks, lighter density
  -- ══════════════════════════════════════════════════════════════════

  INSERT INTO elder_moments (organization_id, elder_id, occurred_on, kind, body, source, created_by) VALUES
    -- Eleanor
    (v_org_id, v_eleanor_id, v_today - 18, 'memory',  'Sat with Charles''s old fishing tackle and remembered the lake summer of ''72.', 'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 24, 'visit',   'Tea with the priest''s wife — she brought lemon cake.', 'caregiver', v_user_id),
    (v_org_id, v_eleanor_id, v_today - 31, 'garden',  'Tied up the late tomatoes against the back wall.', 'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 38, 'memory',  'Pulled out Charles''s record collection. Listened to side one of A Love Supreme.', 'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 45, 'reading', 'Started the Patrick White novel. Said the first page was hard but the second was beautiful.', 'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 52, 'visit',   'Sofia came by with Biscuit. They sat on the porch until the streetlight came on.', 'caregiver', v_user_id),
    (v_org_id, v_eleanor_id, v_today - 60, 'garden',  'Cleared the back bed for next year''s tulips.', 'nagi', NULL),
    (v_org_id, v_eleanor_id, v_today - 68, 'memory',  'Told the story about Charles''s first concert — the night he proposed.', 'nagi', NULL),
    -- Frances
    (v_org_id, v_frances_id, v_today - 17, 'memory',  'Recited the names of every student in her ''68 third-grade class without prompting.', 'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 23, 'visit',   'Pearl had her annual checkup. Frances sat in the waiting room reading aloud to her.', 'caregiver', v_user_id),
    (v_org_id, v_frances_id, v_today - 30, 'memory',  'Sang two verses of "Amazing Grace" with the radio.', 'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 37, 'meal',    'The aide made cornbread and Frances said it tasted like her grandmother''s.', 'caregiver', v_user_id),
    (v_org_id, v_frances_id, v_today - 44, 'memory',  'Watched the cardinals at the window for forty minutes. Named the male "Bert".', 'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 53, 'memory',  'Looked through the 1957 reunion photo album. Named everyone she could.', 'nagi', NULL),
    (v_org_id, v_frances_id, v_today - 61, 'visit',   'Her niece called and they talked about the new baby.', 'caregiver', v_user_id),
    (v_org_id, v_frances_id, v_today - 70, 'memory',  'Pearl curled up on her lap during the morning radio show.', 'nagi', NULL),
    -- Bill
    (v_org_id, v_bill_id, v_today - 19, 'walk',    'Made it to the bench past the post office for the first time this month.', 'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 25, 'hobby',   'Started the P-51 Mustang. Cracked the canopy paint on the first try.', 'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 32, 'memory',  'Watched the Korea documentary. Said the chow hall was almost right.', 'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 40, 'walk',    'Did the full loop without resting. Quiet COPD day.', 'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 47, 'visit',   'The neighbor''s grandson came by to look at the planes again.', 'caregiver', v_user_id),
    (v_org_id, v_bill_id, v_today - 55, 'hobby',   'Finished the Spitfire. Painted the squadron markings from memory.', 'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 63, 'memory',  'Told the story about Charles fixing the carburetor in ''68 with a hairpin.', 'nagi', NULL),
    (v_org_id, v_bill_id, v_today - 72, 'walk',    'Walked to the corner and back twice. New personal best.', 'nagi', NULL);

  RAISE NOTICE 'Pemberton archive seed complete: 12 weekly digests + 24 extended moments across 3 elders.';
END $$;
