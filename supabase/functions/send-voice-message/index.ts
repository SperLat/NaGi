// send-voice-message edge function — receives audio from the sender's
// kiosk, transcribes via Whisper, inserts an elder_messages row.
//
// Flow:
//   1. Verify caller's JWT.
//   2. Verify caller is in the from_elder's org (membership check).
//   3. Verify from_elder is a participant in connection_id (existing
//      RLS would catch an INSERT mismatch, but we raise early).
//   4. Upload audio to storage as <connection_id>/<uuid>.<ext> via
//      service_role.
//   5. POST audio bytes to the Whisper /asr endpoint with the shared
//      secret header. Get transcript + detected language.
//   6. INSERT elder_messages row with body=transcript, audio_path,
//      source_lang.
//   7. Return { message_id, transcript, detected_lang }.
//
// Translation + TTS flow downstream is unchanged: the recipient kiosk
// fetches the row, calls translate-message lazily for its preferred
// lang, plays the resolved body via expo-speech.
//
// Auth posture: Whisper service is fronted by Coolify. Cedar trusts
// the network path because it sends a shared secret header. If the
// secret is wrong, Coolify must reject — otherwise the /asr endpoint
// becomes free GPU for the public internet.
//
// Deployment env vars required:
//   ANTHROPIC_API_KEY        (unused here; reserved for future inline ops)
//   WHISPER_ASR_URL          e.g. https://whisper.web3process.com/asr
//   WHISPER_ASR_SECRET       shared secret, sent as X-Whisper-Auth header

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface AsrResult {
  text?: string;
  language?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('POST required', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const whisperUrl = Deno.env.get('WHISPER_ASR_URL') ?? '';
  const whisperSecret = Deno.env.get('WHISPER_ASR_SECRET') ?? '';

  if (!whisperUrl || !whisperSecret) {
    return jsonError('Whisper not configured', 500);
  }

  const userClient  = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Step 1: who is calling
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonError('Not authenticated', 401);
  const callerId = userRes.user.id;

  // Step 2: parse multipart/form-data
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Expected multipart/form-data', 400);
  }
  const connectionId = String(form.get('connection_id') ?? '');
  const fromElderId  = String(form.get('from_elder_id') ?? '');
  const audio        = form.get('audio_file');

  if (!connectionId || !fromElderId) {
    return jsonError('connection_id and from_elder_id required', 400);
  }
  if (!(audio instanceof File) && !(audio instanceof Blob)) {
    return jsonError('audio_file required (multipart File)', 400);
  }
  // Hard cap on size — voice messages are short. 25 MB matches Whisper
  // upstream limits and prevents accidental GPU bombs.
  if (audio.size === 0 || audio.size > 25 * 1024 * 1024) {
    return jsonError('audio_file size out of range (1B – 25MB)', 400);
  }

  // Step 3: caller must be in from_elder's org. We ask through the
  // user-bound client so RLS scoping does the work.
  const { data: orgCheck } = await userClient
    .from('elders')
    .select('id, organization_id, preferred_lang')
    .eq('id', fromElderId)
    .maybeSingle();
  if (!orgCheck) {
    return jsonError('Not authorized for this elder', 403);
  }
  const senderLang = (orgCheck as { preferred_lang?: string }).preferred_lang ?? null;

  // Step 4: from_elder must be a participant in the connection. Any
  // org member of either side can read the connection row.
  const { data: conn } = await userClient
    .from('elder_connections')
    .select('id, elder_a_id, elder_b_id, status')
    .eq('id', connectionId)
    .maybeSingle();
  if (!conn) return jsonError('Connection not accessible', 403);
  const c = conn as { elder_a_id: string; elder_b_id: string; status: string };
  if (c.elder_a_id !== fromElderId && c.elder_b_id !== fromElderId) {
    return jsonError('Elder is not part of this connection', 403);
  }
  if (c.status !== 'active') {
    return jsonError(`Connection is not active (status=${c.status})`, 409);
  }

  // Step 5: send to Whisper. Forward audio + transcribe task.
  const asrForm = new FormData();
  asrForm.append('audio_file', audio, (audio as File).name ?? `voice.${pickExt((audio as File).type)}`);

  const asrUrl = new URL(whisperUrl);
  asrUrl.searchParams.set('output', 'json');
  asrUrl.searchParams.set('task', 'transcribe');
  asrUrl.searchParams.set('vad_filter', 'true');

  let asr: AsrResult;
  try {
    const r = await fetch(asrUrl.toString(), {
      method: 'POST',
      headers: { 'X-Whisper-Auth': whisperSecret },
      body: asrForm,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => r.statusText);
      return jsonError(`Whisper ${r.status}: ${detail.slice(0, 200)}`, 502);
    }
    asr = (await r.json()) as AsrResult;
  } catch (err) {
    return jsonError(`Whisper unreachable: ${String(err)}`, 502);
  }

  const transcript = (asr.text ?? '').trim();
  if (!transcript) {
    return jsonError('Whisper returned empty transcript', 422);
  }
  if (transcript.length > 4000) {
    // body CHECK constraint maxes at 4000 — keep parity with text path.
    return jsonError('Transcript exceeds 4000 chars', 413);
  }

  const detectedLang = (asr.language ?? '').toLowerCase();
  // Normalize against our supported set; fall back to sender's preferred_lang.
  const sourceLang =
    detectedLang === 'en' || detectedLang === 'es' || detectedLang === 'pt'
      ? detectedLang
      : senderLang ?? null;

  // Step 6: upload original audio to storage. Best-effort — if this
  // fails, we still deliver the transcript-only message rather than
  // losing the whole message. The recipient sees a text message and
  // the "🎙️ Their voice" button hides because audio_path is null.
  // Brand stance: Whisper compute already succeeded; the elder
  // shouldn't lose their message because the bucket hiccuped.
  const ext       = pickExt((audio as File).type);
  const audioPath = `${connectionId}/${crypto.randomUUID()}.${ext}`;
  const audioBuf  = new Uint8Array(await audio.arrayBuffer());
  const { error: upErr } = await adminClient.storage
    .from('elder-voice-messages')
    .upload(audioPath, audioBuf, {
      contentType: (audio as File).type || 'application/octet-stream',
      upsert: false,
    });
  const persistedAudioPath = upErr ? null : audioPath;

  // Step 7: insert message row using the user-bound client so the
  // existing INSERT RLS (caller in either elder's org) gates the write
  // honestly — same posture as the text path.
  const { data: msg, error: insErr } = await userClient
    .from('elder_messages')
    .insert({
      connection_id: connectionId,
      from_elder_id: fromElderId,
      body: transcript,
      audio_path: persistedAudioPath,
      source_lang: sourceLang,
    })
    .select('id, created_at')
    .single();

  if (insErr || !msg) {
    // Insert failed — cleanup any orphaned storage so we don't
    // accumulate untracked files.
    if (persistedAudioPath) {
      await adminClient.storage.from('elder-voice-messages').remove([persistedAudioPath]).catch(() => {});
    }
    return jsonError(`Insert failed: ${insErr?.message ?? 'unknown'}`, 500);
  }

  return jsonOk({
    ok: true,
    message_id: (msg as { id: string }).id,
    transcript,
    detected_lang: sourceLang,
    audio_path: persistedAudioPath,
    audio_persisted: !upErr,
  });
});
