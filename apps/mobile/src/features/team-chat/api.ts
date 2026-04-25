import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import type { TeamMessage } from './types';

/**
 * Reads through the SECURITY DEFINER RPC so each row arrives with
 * author_email already joined. RPC enforces org membership.
 */
export async function listTeamMessages(elderId: string): Promise<TeamMessage[]> {
  if (isMock) return [];
  const { data, error } = await supabase.rpc('list_elder_team_messages', { elder: elderId });
  if (error || !data) return [];
  // RPC returns newest-first; the chat panel renders bottom-up, so we
  // reverse here once and treat the array as chronological in the UI.
  return (data as TeamMessage[]).slice().reverse();
}

/**
 * Resolves author_email for a single message — used after receiving a
 * realtime INSERT (whose payload doesn't include the join).
 */
export async function resolveTeamMessageAuthor(messageId: string): Promise<string | null> {
  if (isMock) return null;
  const { data, error } = await supabase.rpc('resolve_team_message_author', {
    message_id: messageId,
  });
  if (error || !data || (data as Array<{ author_email: string }>).length === 0) return null;
  return (data as Array<{ author_email: string }>)[0].author_email;
}

export async function postTeamMessage(
  elderId: string,
  organizationId: string,
  authorId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isMock) return { ok: true };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: 'Message is empty.' };
  if (trimmed.length > 4000) return { ok: false, message: 'Message is too long.' };

  const { error } = await supabase.from('elder_team_messages').insert({
    elder_id: elderId,
    organization_id: organizationId,
    author_id: authorId,
    body: trimmed,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
