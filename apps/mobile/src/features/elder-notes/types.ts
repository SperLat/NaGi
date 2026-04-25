/**
 * One entry in the shared notes journal for an elder.
 *
 * Surfaces author_email (resolved server-side via the SECURITY DEFINER
 * RPC) so the UI can attribute the note without the app needing
 * auth.users access.
 */
export interface ElderNote {
  id: string;
  body: string;
  occurred_at: string;
  created_at: string;
  author_id: string;
  author_email: string;
}
