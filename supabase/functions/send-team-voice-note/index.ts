// send-team-voice-note edge function — uploads a voice note to the
// care-circle for a specific elder.
//
// Differs from send-voice-message (cross-tenant elder-to-elder):
//   - No Whisper transcription. Team coordination is heard, not read;
//     the brand promise of translation only applies to elder-to-elder.
//   - Single-org auth check (no connection participation). Caller must
//     be in the elder's org.
//   - body is set to a placeholder ('🎙️') because the column has a
//     length-1+ check from migration 0011 and we don't relax it.
//
// Flow:
//   1. Verify caller's JWT.
//   2. Verify caller is in the elder's org (RLS-gated re-fetch).
//   3. Upload audio to team-voice-notes/<elder_id>/<uuid>.<ext>.
//   4. Insert elder_team_messages row with audio_path + placeholder body.
//   5. On insert failure, cleanup the orphaned audio.
//
// Playback is gated through a follow-up function (team-voice-note-url)
// that mints short-lived signed URLs after re-checking org membership.

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VOICE_BODY_PLACEHOLDER = '🎙️';

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function jsonOk(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function pickExt(mime: string | null): string {
  if (!mime) return 'bin';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('POST required', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const userClient  = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonError('Not authenticated', 401);
  const callerId = userRes.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Expected multipart/form-data', 400);
  }
  const elderId = String(form.get('elder_id') ?? '');
  const audio   = form.get('audio_file');

  if (!elderId) return jsonError('elder_id required', 400);
  if (!(audio instanceof File) && !(audio instanceof Blob)) {
    return jsonError('audio_file required (multipart File)', 400);
  }
  if (audio.size === 0 || audio.size > 25 * 1024 * 1024) {
    return jsonError('audio_file size out of range (1B – 25MB)', 400);
  }

  // Membership check via RLS-gated read of the elder row.
  const { data: orgCheck } = await userClient
    .from('elders')
    .select('id, organization_id')
    .eq('id', elderId)
    .maybeSingle();
  if (!orgCheck) return jsonError('Not authorized for this elder', 403);
  const organizationId = (orgCheck as { organization_id: string }).organization_id;

  // Upload audio first. If upload fails, the message never lands —
  // unlike send-voice-message which has a transcript worth preserving,
  // here a voice note with no audio is not useful.
  const ext       = pickExt((audio as File).type);
  const audioPath = `${elderId}/${crypto.randomUUID()}.${ext}`;
  const audioBuf  = new Uint8Array(await audio.arrayBuffer());
  const { error: upErr } = await adminClient.storage
    .from('team-voice-notes')
    .upload(audioPath, audioBuf, {
      contentType: (audio as File).type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return jsonError(`Storage upload failed: ${upErr.message}`, 500);

  // Insert via the user-bound client so existing INSERT RLS gates
  // the write — same posture as the text path through postTeamMessage.
  const { data: msg, error: insErr } = await userClient
    .from('elder_team_messages')
    .insert({
      elder_id: elderId,
      organization_id: organizationId,
      author_id: callerId,
      body: VOICE_BODY_PLACEHOLDER,
      audio_path: audioPath,
    })
    .select('id, created_at')
    .single();

  if (insErr || !msg) {
    await adminClient.storage.from('team-voice-notes').remove([audioPath]).catch(() => {});
    return jsonError(`Insert failed: ${insErr?.message ?? 'unknown'}`, 500);
  }

  return jsonOk({
    ok: true,
    message_id: (msg as { id: string }).id,
    audio_path: audioPath,
  });
});
