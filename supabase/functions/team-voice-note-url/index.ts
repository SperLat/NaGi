// team-voice-note-url edge function — short-lived signed URL for a
// team voice-note's original audio. Mirrors voice-message-url for the
// elder-to-elder bucket, but reads from team-voice-notes.

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNED_URL_TTL_SEC = 300;

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('POST required', 405);

  let body: { message_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const messageId = body.message_id;
  if (!messageId) return jsonError('message_id required', 400);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonError('Not authenticated', 401);

  // RLS on elder_team_messages already gates org-membership reads. If
  // the caller can SELECT the row, they're authorized to play the note.
  const { data: msg } = await userClient
    .from('elder_team_messages')
    .select('id, audio_path')
    .eq('id', messageId)
    .maybeSingle();

  if (!msg) return jsonError('Message not accessible', 403);
  const audioPath = (msg as { audio_path?: string | null }).audio_path;
  if (!audioPath) return jsonError('Message has no audio', 404);

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: signed, error } = await adminClient.storage
    .from('team-voice-notes')
    .createSignedUrl(audioPath, SIGNED_URL_TTL_SEC);

  if (error || !signed?.signedUrl) {
    return jsonError(`Sign failed: ${error?.message ?? 'unknown'}`, 500);
  }

  return new Response(
    JSON.stringify({ url: signed.signedUrl, expires_in_sec: SIGNED_URL_TTL_SEC }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
