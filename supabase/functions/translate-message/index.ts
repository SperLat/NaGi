// translate-message edge function — on-demand translation of an elder
// message body into a target language. Caches the result on the row in
// the body_translated JSONB so subsequent reads in the same target lang
// are zero-cost.
//
// Model: claude-haiku-4-5. Translation is a low-variance task, fast,
// cheap. We pass the source body + target lang code; the model returns
// just the translated text (no preamble, no quotes).
//
// Auth: caller must be authenticated and able to SELECT the message via
// RLS — we re-fetch using the caller's JWT so a request with the wrong
// access can't translate someone else's message.
//
// Idempotency: if the translation for target_lang is already present,
// we skip the API call and return the cached value.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../_shared/rate-limit.ts';

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

function langName(code: string): string {
  const map: Record<string, string> = { es: 'Spanish', pt: 'Portuguese', en: 'English' };
  return map[code] ?? 'English';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: { message_id?: string; target_lang?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const { message_id, target_lang } = body;
  if (!message_id || !target_lang) {
    return jsonError('message_id and target_lang required', 400);
  }
  if (!['en', 'es', 'pt'].includes(target_lang)) {
    return jsonError('Unsupported target_lang', 400);
  }

  // Auth: verify the caller via their JWT. Use the user-bound client
  // for the SELECT so RLS applies — a caller cannot translate a message
  // they cannot read.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonError('Not authenticated', 401);
  if (!checkRateLimit(userRes.user.id)) return jsonError('Rate limit exceeded', 429);

  const { data: msg, error: msgErr } = await userClient
    .from('elder_messages')
    .select('id, body, body_translated, from_elder_id, connection_id')
    .eq('id', message_id)
    .single();

  if (msgErr || !msg) return jsonError('Message not accessible', 403);

  const cached = (msg.body_translated as Record<string, string> | null)?.[target_lang];
  if (cached) {
    return new Response(
      JSON.stringify({ translated: cached, cached: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  // Determine source language from sender's elder. Use service-role
  // client because elder rows in another org aren't readable via RLS
  // from the caller — but we already verified the caller can read the
  // message itself, which means they're a participant in the connection.
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: senderElder } = await adminClient
    .from('elders')
    .select('preferred_lang')
    .eq('id', (msg as { from_elder_id: string }).from_elder_id)
    .single();

  const sourceLang = (senderElder as { preferred_lang?: string } | null)?.preferred_lang ?? 'en';
  if (sourceLang === target_lang) {
    return new Response(
      JSON.stringify({ translated: (msg as { body: string }).body, cached: false, no_op: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

  const translationPrompt = `Translate the following message from ${langName(sourceLang)} to ${langName(target_lang)}. The speaker is an elderly person sending a personal message to a friend who speaks the target language. Preserve their tone — warmth, hesitation, simplicity. Do NOT add explanations or quotes. Output the translation only, nothing else.

Message:
${(msg as { body: string }).body}`;

  let translated: string;
  try {
    const response = await anthropic.messages.create(
      {
        // MODELS — change here when Anthropic releases a new version
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: translationPrompt }],
      },
      { timeout: 15_000 },
    );
    translated = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    return jsonError(`Translation failed: ${String(err)}`, 502);
  }

  const existing = (msg.body_translated as Record<string, string>) ?? {};
  existing[target_lang] = translated;

  const { error: updateErr } = await adminClient
    .from('elder_messages')
    .update({ body_translated: existing })
    .eq('id', message_id);

  if (updateErr) {
    return new Response(
      JSON.stringify({ translated, cached: false, cache_failed: updateErr.message }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ translated, cached: false }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
