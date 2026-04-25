import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import type { ElderNote } from './types';

/**
 * Reads through the SECURITY DEFINER RPC `list_elder_notes` so each
 * note arrives with author_email already joined from auth.users.
 *
 * Mock mode returns an empty list — the journal screen renders its
 * empty state, which is the right demo experience.
 */
export async function listElderNotes(elderId: string): Promise<ElderNote[]> {
  if (isMock) return [];

  const { data, error } = await supabase.rpc('list_elder_notes', { elder: elderId });
  if (error || !data) return [];

  return data as ElderNote[];
}

/**
 * Posts a new note. The DB enforces author_id = auth.uid() in the RLS
 * INSERT policy, so we don't need to defend against impersonation here —
 * we just pass the caller's user id and let Postgres reject mismatches.
 *
 * Optimistic UI lives in the screen: the post returns immediately and
 * the screen re-fetches to surface the canonical row (with the real id
 * + author_email from the RPC).
 */
export async function postElderNote(
  elderId: string,
  organizationId: string,
  authorId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isMock) return { ok: true };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: 'Note is empty.' };
  if (trimmed.length > 8000) return { ok: false, message: 'Note is too long.' };

  const { error } = await supabase.from('elder_notes').insert({
    elder_id: elderId,
    organization_id: organizationId,
    author_id: authorId,
    body: trimmed,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Delete a note. The DB only allows the author to delete; if a
 * non-author calls this the row count returned will be 0 and the
 * UI just won't see the note disappear on next refresh.
 */
export async function deleteElderNote(noteId: string): Promise<void> {
  if (isMock) return;
  await supabase.from('elder_notes').delete().eq('id', noteId);
}
