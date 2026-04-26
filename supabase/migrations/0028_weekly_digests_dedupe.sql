-- Weekly digest dedupe — overwrite-same-day, keep older entries.
-- ──────────────────────────────────────────────────────────────────
-- Without this, every click of "Generate this week's summary" appends
-- a new row. A caregiver clicking twice in 30 seconds clutters the
-- archive panel they just looked at.
--
-- Brand stance: a single elder has at most one digest per calendar day.
-- Multiple clicks within a day produce one row that reflects the latest
-- generation; entries from earlier days stay as they were when they
-- were generated. Caregiver mental model matches the data model.
--
-- Implementation: a separate `period_end_day` date column carries the
-- dedupe key, leaving `period_end` as the precise generation timestamp.
-- supabase-js upsert needs concrete column names in onConflict, so an
-- expression index on date(period_end) wouldn't work — hence the column.

ALTER TABLE weekly_digests
  ADD COLUMN period_end_day date;

-- Backfill seeded rows so the NOT NULL + unique constraints below pass.
UPDATE weekly_digests
   SET period_end_day = period_end::date
 WHERE period_end_day IS NULL;

ALTER TABLE weekly_digests
  ALTER COLUMN period_end_day SET NOT NULL;

-- One digest per elder per generation day. Re-clicks within the same
-- day overwrite via ON CONFLICT in the edge function.
CREATE UNIQUE INDEX weekly_digests_elder_day_unique_idx
  ON weekly_digests (elder_id, period_end_day);
