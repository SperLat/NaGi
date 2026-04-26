import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import { env } from '@/config/env';
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
 * Resolves a render-ready display name for a single message author —
 * used after receiving a realtime INSERT (whose payload lacks the join).
 * Returns the chosen display_name if set, else the email-handle fallback.
 */
export async function resolveTeamMessageAuthor(messageId: string): Promise<string | null> {
  if (isMock) return null;
  const { data, error } = await supabase.rpc('resolve_team_message_author', {
    message_id: messageId,
  });
  if (error || !data) return null;
  const row = (data as Array<{ author_display_name: string | null }>)[0];
  return row?.author_display_name ?? null;
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

/**
 * Post a voice note to the care circle for one elder. Posts the audio
 * blob to send-team-voice-note which uploads + inserts. No translation
 * or transcription — team coordination is heard, not read.
 */
export async function postTeamVoiceNote(
  elderId: string,
  audio: Blob,
  filename: string,
): Promise<{ ok: true; messageId: string } | { ok: false; message: string }> {
  if (isMock) return { ok: true, messageId: 'mock-team-voice' };

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, message: 'Not authenticated' };

  const form = new FormData();
  form.append('elder_id', elderId);
  form.append('audio_file', audio, filename);

  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/send-team-voice-note`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message_id?: string; error?: string };
    if (!res.ok || !data.ok || !data.message_id) {
      return { ok: false, message: data.error ?? `send-team-voice-note ${res.status}` };
    }
    return { ok: true, messageId: data.message_id };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

/**
 * Get a short-lived signed URL for a team voice-note's audio. Returns
 * null if the message has no audio or the call fails.
 */
export async function getTeamVoiceNoteUrl(messageId: string): Promise<string | null> {
  if (isMock) return null;
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return null;
  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/team-voice-note-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message_id: messageId }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}
