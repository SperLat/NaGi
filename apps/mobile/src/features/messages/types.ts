export interface ElderMessage {
  id: string;
  connection_id: string;
  from_elder_id: string;
  body: string;
  /** Map of language code -> translated body. Populated lazily by the
   *  translate-message edge function on first read in a non-source lang. */
  body_translated: Record<string, string>;
  /** Storage key in the elder-voice-messages bucket for voice messages.
   *  Null for text-only messages. */
  audio_path: string | null;
  /** Whisper-detected language for voice, sender's preferred_lang for
   *  text. Drives the source side of translate-message. May be null on
   *  legacy rows from before migration 0023. */
  source_lang: 'en' | 'es' | 'pt' | null;
  created_at: string;
  read_at: string | null;
}

export interface ResolvedMessage extends ElderMessage {
  /** body in target lang if available, else original body. */
  resolved_body: string;
  /** True if resolved_body came from translation, false if original. */
  was_translated: boolean;
}
