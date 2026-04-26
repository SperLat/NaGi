// voice-message-url edge function — returns a short-lived signed URL
// for the original audio of a voice message.
//
// The elder-voice-messages bucket is private. Direct storage RLS is
// not exposed for this bucket — all access goes through this function
// so we can verify connection participation before minting the URL.
//
// Flow:
//   1. Verify caller's JWT.
//   2. Re-fetch the message row through the user-bound client so RLS
//      gates whether the caller can read this message at all (they
//      must be in either elder's org of the connection — same RLS as
//      the text-reading path).
//   3. If the row has no audio_path, return 404.
//   4. Mint a signed URL via service_role (storage policies don't
//      apply to service_role anyway; the gate is the RLS check above).
//   5. Return { url, expires_in_sec }.
//
// Brand stance: short TTL (5 min). The URL is for "hear it now," not
// for sharing. If the elder wants to listen again, the kiosk re-asks
// for a fresh URL — cheap, and keeps the audio behind the auth gate
// rather than scattering long-lived URLs across logs and caches.

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SIGNED_URL_TTL_SEC = 300; // 5 minutes

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

  // RLS-gated read: if caller can't see this message, they can't get its audio.
  const { data: msg } = await userClient
    .from('elder_messages')
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
    .from('elder-voice-messages')
    .createSignedUrl(audioPath, SIGNED_URL_TTL_SEC);

  if (error || !signed?.signedUrl) {
    return jsonError(`Sign failed: ${error?.message ?? 'unknown'}`, 500);
  }

  return new Response(
    JSON.stringify({ url: signed.signedUrl, expires_in_sec: SIGNED_URL_TTL_SEC }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
