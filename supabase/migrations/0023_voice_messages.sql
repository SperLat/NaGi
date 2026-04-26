-- Voice messages on elder-to-elder connections.
-- ──────────────────────────────────────────────────────────────────────
-- The text-only messaging path already works end-to-end: typed body →
-- translate-message (Claude Haiku) → recipient kiosk plays the resolved
-- body via expo-speech in their preferred_lang.
--
-- Voice messaging adds a transcription front-end. The sender records
-- audio; the send-voice-message edge function calls Whisper /asr on the
-- bytes, writes the transcript into body, and stores the original
-- audio in private storage so the recipient can optionally hear the
-- sender's actual voice (the brand stance: text translation honors the
-- meaning, the original recording honors the warmth). Translation +
-- TTS flow downstream is unchanged.

-- ── Schema additions ────────────────────────────────────────────────
ALTER TABLE elder_messages
  ADD COLUMN audio_path  text,
  ADD COLUMN source_lang text
    CHECK (source_lang IS NULL OR source_lang IN ('en', 'es', 'pt'));

COMMENT ON COLUMN elder_messages.audio_path IS
  'Storage key in the elder-voice-messages bucket when the sender used '
  'voice. NULL for text-only messages. The edge function uploads under '
  '<connection_id>/<message_id>.<ext> with service_role.';

COMMENT ON COLUMN elder_messages.source_lang IS
  'Language detected by Whisper for voice messages, or sender''s '
  'preferred_lang for text. Drives the source-side of the translate-'
  'message function so a Spanish-speaking elder writing in English '
  'still translates correctly for the recipient.';

-- ── Storage bucket for original audio ──────────────────────────────
-- Private bucket; clients never upload directly. The send-voice-message
-- edge function holds service_role and uploads on the caller's behalf
-- after verifying connection participation. Recipients read via signed
-- URLs from a dedicated playback function (not exposed via direct
-- storage RLS — keeps the surface narrow).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('elder-voice-messages', 'elder-voice-messages', false)
  ON CONFLICT (id) DO NOTHING;

-- No client-side INSERT/UPDATE policy on storage.objects for this bucket.
-- All writes go through service_role in the edge function. Reads are
-- gated through the voice-message-url edge function: it RLS-checks the
-- caller against elder_messages first (caller must be in either elder's
-- org of the connection), then mints a 5-minute signed URL via
-- service_role. Short TTL keeps the audio behind the auth gate rather
-- than scattering long-lived URLs across logs and caches.
