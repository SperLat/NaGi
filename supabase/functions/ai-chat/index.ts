// ai-chat edge function — streaming conversational AI for elder sessions.
// Model: claude-opus-4-7 with prompt caching on elder profile.
// Flow: validate JWT → check membership → stream Claude → log ai_interactions

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { STATIC_SYSTEM, buildElderSystemBlock } from '../_shared/anthropic.ts';
import { resolveSkills } from '../_shared/skills.ts';
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

  // Three-layer cache: static policy (deploy-level) + skill bundle (mostly
  // shared across elders) + per-elder profile (profile_version). The skill
  // block goes BEFORE the per-elder block so it stays cache-stable when one
  // elder's profile changes — Anthropic invalidates from the first changed
  // block forward, so the cheaper-to-recompute thing comes last.
  const profileObj: Record<string, unknown> =
    typeof elder.profile === 'string' ? JSON.parse(elder.profile) : (elder.profile ?? {});
  const skills = resolveSkills(profileObj, elder.preferred_lang);

  const systemBlocks: Array<{
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  }> = [
    { type: 'text', text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' } },
  ];
  if (skills.text) {
    systemBlocks.push({
      type: 'text',
      text: skills.text,
      cache_control: { type: 'ephemeral' },
    });
  }
  systemBlocks.push({
    type: 'text',
    text: buildElderSystemBlock(elder),
    cache_control: { type: 'ephemeral' },
  });

  // ── Long-context recall (Opus 4.7's 1M context window) ────────────────
  // Opt-in via profile.long_context_recall. Loads up to ~200 prior ai_turn
  // rows so Nagi can recall what the elder said weeks ago without RAG.
  // Goes AFTER the cached per-elder block — uncached itself, but does not
  // invalidate the prefix cache. Cost scales with history size, hence opt-in.
  let recallTurns = 0;
  if (profileObj.long_context_recall === true) {
    const { data: history } = await db
      .from('activity_log')
      .select('payload, client_ts')
      .eq('elder_id', elder_id)
      .eq('kind', 'ai_turn')
      .order('server_ts', { ascending: false })
      .limit(200);

    if (history && history.length > 0) {
      const lines: string[] = [];
      // Reverse so oldest-first reads chronologically; cap total chars at
      // ~600K (≈150K tokens) to leave room for response + new turn.
      const ordered = [...history].reverse();
      let charBudget = 600_000;
      for (const row of ordered) {
        const p = row.payload as { message?: string; response?: string };
        const day = String(row.client_ts).slice(0, 10);
        const entry =
          `[${day}] elder: ${(p.message ?? '').slice(0, 1500)}\n` +
          `[${day}] you: ${(p.response ?? '').slice(0, 1500)}\n`;
        if (entry.length > charBudget) break;
        lines.push(entry);
        charBudget -= entry.length;
        recallTurns++;
      }
      if (lines.length > 0) {
        systemBlocks.push({
          type: 'text',
          text:
            `RECENT CONVERSATION HISTORY with this elder, oldest first. ` +
            `Use it the way a friend would — recall something specific only if ` +
            `it's genuinely relevant to what they're asking now. Do not ` +
            `summarize the history unprompted.\n\n` +
            lines.join('\n'),
          // No cache_control — this segment changes every turn. The cached
          // prefix above (static + skills + per-elder) is unaffected.
        });
      }
    }
  }

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
          // MODELS — change here when Anthropic releases a new version
          model: 'claude-opus-4-7',
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
        // MODELS — change here when Anthropic releases a new version
        model: 'claude-opus-4-7',
        profile_version: (elder as { profile_version: number }).profile_version,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: cacheReadTokens,
        cache_write_tokens: cacheWriteTokens,
        recall_turns: recallTurns,
        latency_ms: Date.now() - startTs,
        error: aiError,
      });
    }
  })();

  return streamResponse;
});
