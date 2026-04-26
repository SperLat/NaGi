-- User kiosk PINs: per-account device PIN, source-of-truth in the DB.
-- ────────────────────────────────────────────────────────────────────
-- Prior model: device PIN stored only in browser localStorage. On web
-- that ranges from "ephemeral" to "actively cleared by the browser"
-- (incognito close, ITP partitioning, manual cache clear). A caregiver
-- who set a PIN during the walkthrough and then cleared cookies got
-- locked out of intermediary mode with no recovery path — opposite of
-- Cedar's calm-and-honest stance.
--
-- New model:
--   - DB row per user is the source of truth.
--   - Browser localStorage stays as a write-through cache for offline
--     verify (no round-trip on every PIN attempt).
--   - "Forgot PIN" recovery: any signed-in caregiver can clear their
--     own row via /locked → resets to "no PIN set" → next entry to
--     intermediary mode is direct (no PIN gate). Same threat model as
--     before: device PIN deters incidental navigation, not determined
--     attackers (per kiosk.ts:11-13). A valid session JWT is already
--     proof of the caregiver's identity.
--
-- The elder kiosk PIN (kiosk_pin_hash on the elders row) is unchanged.
-- That one is per-elder, not per-user, and recovers via the caregiver-
-- side Configure interface — different system, different recovery.

CREATE TABLE user_kiosk_pins (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash   text        NOT NULL,
  pin_salt   text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_kiosk_pins ENABLE ROW LEVEL SECURITY;

-- All four operations: only the owner. Other users have no business
-- reading or touching this row, full stop.
CREATE POLICY "users read their own kiosk pin"
  ON user_kiosk_pins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users insert their own kiosk pin"
  ON user_kiosk_pins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update their own kiosk pin"
  ON user_kiosk_pins FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete their own kiosk pin"
  ON user_kiosk_pins FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
