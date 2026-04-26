/**
 * One message in the per-elder care-team chat.
 *
 * author_email arrives joined via the SECURITY DEFINER RPC. For realtime
 * INSERTs the payload arrives without the join, so we fall back to the
 * resolver RPC and patch the row in place.
 */
export interface TeamMessage {
  id: string;
  body: string;
  /** Storage key in the team-voice-notes bucket for voice notes. NULL
   *  for text-only messages. body is set to a placeholder ('🎙️') for
   *  voice-only inserts; UI checks audio_path to decide rendering. */
  audio_path: string | null;
  created_at: string;
  author_id: string;
  author_email: string;
}
