-- Long-context recall observability.
-- When elders.profile.long_context_recall is true, ai-chat appends prior
-- ai_turn rows from activity_log into the system block (using Opus 4.7's
-- 1M context window). recall_turns records how many were actually included
-- after the char-budget trim, so the dashboard can show "Nagi recalled N
-- prior conversations" and we can audit cost vs. relevance.
ALTER TABLE ai_interactions
  ADD COLUMN recall_turns int NOT NULL DEFAULT 0;
