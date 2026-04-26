import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import { env } from '@/config/env';
import type { ElderMessage, ResolvedMessage } from './types';

/**
 * Resolve a message body in a target language. Returns the translation
 * if cached, otherwise the original body and a flag indicating no
 * translation yet (caller may want to trigger one).
 */
export function resolveMessage(message: ElderMessage, targetLang: string): ResolvedMessage {
  const t = message.body_translated?.[targetLang];
  return {
    ...message,
    resolved_body: t || message.body,
    was_translated: Boolean(t),
  };
}

/**
 * List messages on a connection, newest-first, capped at limit.
 * RLS scopes results to the caller's org (RLS handles the bridge logic).
 */
export async function listMessages(
  connectionId: string,
  limit = 50,
): Promise<ElderMessage[]> {
  if (isMock) return [];
  const { data } = await supabase
    .from('elder_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as ElderMessage[];
}

/**
 * Unread messages addressed to a specific elder across all of the
 * caller's connections. Used by the elder home to surface a "Mensaje
 * de <other>" card when there's something new to hear.
 *
 * "Addressed to me" = from_elder_id != myElderId AND read_at is null.
 */
export async function listUnreadForElder(myElderId: string): Promise<ElderMessage[]> {
  if (isMock) return [];

  // First find connections involving this elder.
  const { data: conns } = await supabase
    .from('elder_connections')
    .select('id')
    .or(`elder_a_id.eq.${myElderId},elder_b_id.eq.${myElderId}`)
    .eq('status', 'active');
  const connectionIds = (conns ?? []).map((c: { id: string }) => c.id);
  if (connectionIds.length === 0) return [];

  const { data } = await supabase
    .from('elder_messages')
    .select('*')
    .in('connection_id', connectionIds)
    .neq('from_elder_id', myElderId)
    .is('read_at', null)
    .order('created_at', { ascending: false });

  return (data ?? []) as ElderMessage[];
}

export async function sendMessage(
  connectionId: string,
  fromElderId: string,
  body: string,
): Promise<{ ok: boolean; error: string | null; messageId?: string }> {
  if (isMock) return { ok: true, error: null, messageId: 'mock-msg' };

  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Empty message' };
  if (trimmed.length > 4000) return { ok: false, error: 'Message too long' };

  const { data, error } = await supabase
    .from('elder_messages')
    .insert({
      connection_id: connectionId,
      from_elder_id: fromElderId,
      body: trimmed,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null, messageId: (data as { id: string }).id };
}

/**
 * Send a voice message: posts the audio blob to send-voice-message,
 * which transcribes via Whisper, stores the original audio in the
 * private elder-voice-messages bucket, and inserts the elder_messages
 * row with body=transcript and source_lang detected. The recipient's
 * existing flow (translate-message → expo-speech) handles the rest.
 *
 * Audio file: typically m4a (mobile) or webm (web). The function
 * accepts whatever MIME the client sends; Whisper handles it.
 *
 * Returns the new message id and transcript on success. The recipient's
 * realtime subscription on elder_messages picks up the new row
 * automatically.
 */
export async function sendVoiceMessage(
  connectionId: string,
  fromElderId: string,
  audio: Blob,
  filename: string,
): Promise<{
  ok: boolean;
  error: string | null;
  messageId?: string;
  transcript?: string;
}> {
  if (isMock) return { ok: true, error: null, messageId: 'mock-voice', transcript: '(mock)' };

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, error: 'Not authenticated' };

  const form = new FormData();
  form.append('connection_id', connectionId);
  form.append('from_elder_id', fromElderId);
  form.append('audio_file', audio, filename);

  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/send-voice-message`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({})) as {
      ok?: boolean;
      message_id?: string;
      transcript?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? `send-voice-message ${res.status}` };
    }
    return { ok: true, error: null, messageId: data.message_id, transcript: data.transcript };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Get a short-lived signed URL for a voice message's original audio.
 * Returns null if the message has no audio or the call fails. The URL
 * is valid for 5 min — if the elder taps "Hear voice" again later,
 * the kiosk re-fetches a fresh one.
 */
export async function getVoiceMessageUrl(messageId: string): Promise<string | null> {
  if (isMock) return null;
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return null;
  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/voice-message-url`, {
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

export async function markMessageRead(messageId: string): Promise<void> {
  if (isMock) return;
  await supabase
    .from('elder_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
}

/**
 * Trigger the translate-message edge function for a message. Returns
 * after the edge function commits the translation. Caller should refetch
 * the message row to get the updated body_translated. Idempotent: if the
 * translation already exists for the target lang, the function is a no-op.
 */
export async function ensureTranslation(
  messageId: string,
  targetLang: string,
): Promise<void> {
  if (isMock) return;
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return;

  await fetch(`${env.supabaseUrl}/functions/v1/translate-message`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message_id: messageId, target_lang: targetLang }),
  }).catch(() => {});
}
