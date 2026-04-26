-- Per-turn privacy boundary the elder can choose to draw.
--
-- Sets to true via three independent paths, all of which converge here:
--
--   1. Keyword match — the elder said something like "this is private" or
--      "between us" in their message. Detected client-side in
--      apps/mobile/src/features/ai-chat/api.ts, set at logActivity time.
--
--   2. Model marker — Nagi's system prompt instructs it to append the
--      literal token `[private]` to its response when the conversation
--      drifts into one of the elder's profile.topics_to_keep_private
--      entries. The mobile client strips the marker before display and
--      sets is_private = true on the resulting activity_log row.
--
--   3. Daily share toggle — the elder taps a pill on their home screen
--      to retroactively hide today's chat from the family dashboard.
--      Bulk-updates is_private across all of today's rows for that elder.
--
-- Filter rule: any consumer that displays substance to the family
-- (transcript view, digest, dashboard previews) must filter on
-- is_private = false. The row is still kept (count, timestamp), but the
-- content is replaced with a placeholder so the family member sees
-- "a private moment" — honest about the boundary, opaque about the
-- substance.
--
-- The flag does NOT propagate to the AI's long-context recall input
-- on subsequent turns: Nagi still remembers privately, just nobody
-- else does. (See ai-chat/index.ts long_context_recall path.)
ALTER TABLE activity_log
  ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Partial index so the common dashboard / transcript / digest queries
-- ("show me public ai_turns from the last N days") get a tight scan.
-- Private rows are the minority by design, so a partial index on the
-- false branch is the right shape.
CREATE INDEX activity_log_public_elder_ts_idx
  ON activity_log (elder_id, server_ts DESC)
  WHERE is_private = false;
