// ai-chat edge function — streaming conversational AI for elder sessions.
// Model: claude-sonnet-4-6 with prompt caching on elder profile.
// Flow: validate JWT → check membership → stream Claude → log ai_interactions

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { STATIC_SYSTEM, buildElderSystemBlock } from '../_shared/anthropic.ts';
import { verifyAndCheckMembership } from '../_shared/auth.ts';
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: { elder_id?: string; messages?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { elder_id, messages } = body;
  if (!elder_id || !Array.isArray(messages) || messages.length === 0) {
    return jsonError('elder_id and messages[] required', 400);
  }

  const authResult = await verifyAndCheckMembership(req, elder_id);
  if ('error' in authResult) return jsonError(authResult.error, 401);

  const { userId, organizationId } = authResult;

  if (!checkRateLimit(userId)) return jsonError('Rate limit exceeded', 429);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: elder } = await db
    .from('elders')
    .select('display_name, preferred_lang, profile, profile_version')
    .eq('id', elder_id)
    .single();

  if (!elder) return jsonError('Elder not found', 404);

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

  // Two-layer cache: static policy (deploy-level) + per-elder profile (profile_version)
  const systemBlocks = [
    { type: 'text' as const, text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' as const } },
    {
      type: 'text' as const,
      text: buildElderSystemBlock(elder),
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  const startTs = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let aiError: string | null = null;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const streamResponse = new Response(readable, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });

  (async () => {
    try {
      const stream = anthropic.messages.stream(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemBlocks,
          // deno-lint-ignore no-explicit-any
          messages: messages as any,
        },
        { timeout: 25_000 }, // 25s — kills hung requests before edge runtime does (30s wall clock)
      );

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          await writer.write(
            enc.encode(`data: ${JSON.stringify({ type: 'text', text: chunk.delta.text })}\n\n`),
          );
        }
        // deno-lint-ignore no-explicit-any
        const usage = (chunk as any).message?.usage ?? (chunk as any).usage;
        if (usage) {
          if (usage.input_tokens) inputTokens = usage.input_tokens;
          if (usage.output_tokens) outputTokens = usage.output_tokens;
          if (usage.cache_read_input_tokens) cacheReadTokens = usage.cache_read_input_tokens;
          if (usage.cache_creation_input_tokens) cacheWriteTokens = usage.cache_creation_input_tokens;
        }
      }

      await writer.write(enc.encode('data: [DONE]\n\n'));
    } catch (err) {
      aiError = String(err);
      await writer.write(
        enc.encode(`data: ${JSON.stringify({ type: 'error', error: aiError })}\n\n`),
      );
    } finally {
      await writer.close().catch(() => {});

      await db.from('ai_interactions').insert({
        elder_id,
        organization_id: organizationId,
        model: 'claude-sonnet-4-6',
        profile_version: (elder as { profile_version: number }).profile_version,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: cacheReadTokens,
        cache_write_tokens: cacheWriteTokens,
        latency_ms: Date.now() - startTs,
        error: aiError,
      });
    }
  })();

  return streamResponse;
});
