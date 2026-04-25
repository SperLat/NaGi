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
  created_at: string;
  author_id: string;
  author_email: string;
}
