-- Per-elder PIN for exiting elder mode on a handed-over device.
-- The hash + salt pair lives on the elder row so it syncs across the
-- intermediary's devices (a caregiver who configured the PIN on a
-- desktop can hand the same elder over from a tablet without resetting
-- it). RLS already restricts elder rows to org members, so the hash is
-- not exposed beyond the legitimate care circle.
--
-- Both columns are nullable: NULL means the elder has not been handed
-- over to a device yet. The intermediary surface refuses "Hand to
-- elder" when these are NULL and prompts to set them first.
--
-- The plaintext PIN never leaves the device. Verification happens
-- client-side after fetching the row — appropriate for a civility
-- boundary against incidental navigation, not a remote-attacker
-- defense.
ALTER TABLE elders
  ADD COLUMN kiosk_pin_hash text,
  ADD COLUMN kiosk_pin_salt text;
