// generate-digest edge function — narrative weekly summary for an elder.
// Reads the past 7 days of activity, AI usage, and help requests, and
// asks Claude (Sonnet — narrative quality matters more than latency) to
// produce a markdown digest a caregiver can forward to a sibling.
//
// Stateless v1: no persistence. The frontend gets markdown + stats, shows
// a copy-to-clipboard button, and that's the whole loop. Persistence is
// a follow-up — start cheap, see if anyone uses it.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { verifyAndCheckMembership } from '../_shared/auth.ts';

// deno-lint-ignore no-explicit-any
const env = (Deno as any).env;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: CORS });
}

interface DigestStats {
  questions_asked: number;
  errors: number;
  offline_unavailable: number;
  help_requests_total: number;
  help_requests_acknowledged: number;
  help_requests_pending: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: { elder_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { elder_id } = body;
  if (!elder_id) return jsonError('elder_id required', 400);

  const auth = await verifyAndCheckMembership(req, elder_id);
  if ('error' in auth) return jsonError(auth.error, 401);

  const db = createClient(
    env.get('SUPABASE_URL') ?? '',
    env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 3600_000);
  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();

  // ── Pull source data in parallel ─────────────────────────────────────
  // Elder for the system block; activity for what happened; ai_interactions
  // for usage + errors; help_requests for the support pipeline. Each is a
  // narrow select — the digest prompt doesn't need raw payloads, just
  // counts and snippets.
  const [elderRes, activityRes, aiRes, helpRes] = await Promise.all([
    db.from('elders').select('display_name, preferred_lang, profile').eq('id', elder_id).single(),
    db
      .from('activity_log')
      .select('kind, payload, client_ts')
      .eq('elder_id', elder_id)
      .gte('client_ts', periodStartIso)
      .order('client_ts', { ascending: false })
      .limit(500),
    db
      .from('ai_interactions')
      .select('input_tokens, output_tokens, latency_ms, error, created_at')
      .eq('elder_id', elder_id)
      .gte('created_at', periodStartIso),
    db
      .from('help_requests')
      .select('id, message, status, created_at, acknowledged_at, acknowledged_by')
      .eq('elder_id', elder_id)
      .gte('created_at', periodStartIso),
  ]);

  if (!elderRes.data) return jsonError('Elder not found', 404);

  const elder = elderRes.data as {
    display_name: string;
    preferred_lang: string;
    profile: Record<string, unknown> | string;
  };
  const profile: Record<string, unknown> =
    typeof elder.profile === 'string' ? JSON.parse(elder.profile) : (elder.profile ?? {});
  const callName =
    (typeof profile.preferred_name === 'string' && profile.preferred_name.trim()) ||
    elder.display_name;

  // ── Stats ────────────────────────────────────────────────────────────
  const activity = (activityRes.data ?? []) as Array<{
    kind: string;
    payload: unknown;
    client_ts: string;
  }>;
  const aiRows = (aiRes.data ?? []) as Array<{
    input_tokens: number | null;
    output_tokens: number | null;
    error: string | null;
  }>;
  const help = (helpRes.data ?? []) as Array<{
    message: string | null;
    status: string;
    acknowledged_at: string | null;
  }>;

  const stats: DigestStats = {
    questions_asked: activity.filter(a => a.kind === 'ai_turn').length,
    errors: activity.filter(a => a.kind === 'error').length,
    offline_unavailable: activity.filter(a => a.kind === 'offline_ai_unavailable').length,
    help_requests_total: help.length,
    help_requests_acknowledged: help.filter(h => h.status === 'acknowledged').length,
    help_requests_pending: help.filter(h => h.status === 'pending').length,
    ai_input_tokens: aiRows.reduce((s, r) => s + (r.input_tokens ?? 0), 0),
    ai_output_tokens: aiRows.reduce((s, r) => s + (r.output_tokens ?? 0), 0),
  };

  // ── No-data short-circuit ────────────────────────────────────────────
  // Don't burn a Claude call on nothing — return a friendly stub so the
  // UI can show "no activity this week" without a 5-second wait.
  if (
    stats.questions_asked === 0 &&
    stats.help_requests_total === 0 &&
    stats.errors === 0 &&
    stats.offline_unavailable === 0
  ) {
    return new Response(
      JSON.stringify({
        digest_markdown: `## This week with ${callName}\n\nNo activity in Nagi this past week. Check in if that's unexpected — it may just mean ${callName} took a quiet week, or it may mean the app stopped feeling useful.`,
        period_start: periodStartIso,
        period_end: periodEndIso,
        stats,
      }),
      { headers: CORS },
    );
  }

  // ── Build the prompt ─────────────────────────────────────────────────
  // Hand Claude a structured brief, not raw rows. The model writes the
  // narrative; we shape what it sees so the narrative stays grounded.
  const recentTurns = activity
    .filter(a => a.kind === 'ai_turn')
    .slice(0, 12)
    .map(a => {
      const p = (typeof a.payload === 'string' ? JSON.parse(a.payload) : a.payload) as
        | { message?: string; response?: string }
        | null;
      return `- "${(p?.message ?? '').trim().slice(0, 140)}"`;
    })
    .filter(line => line.length > 6) // drop empties
    .join('\n');

  const helpLines = help
    .slice(0, 10)
    .map(h => {
      const status = h.status === 'acknowledged' ? '✓ handled' : '⏳ pending';
      return `- ${status}: "${(h.message ?? '').trim().slice(0, 120)}"`;
    })
    .join('\n');

  const profileLine = profile.communication_notes
    ? `Caregiver notes about ${callName}: ${String(profile.communication_notes).slice(0, 280)}`
    : '';

  const userPrompt = `Write a warm, honest weekly digest for the family of ${callName} (an elder using Nagi, an AI companion app).

The digest is for siblings/family who weren't here this week and want to know how their parent is doing with the technology and in life. It should feel like a thoughtful note from someone who pays attention — not a status report.

Period: ${periodStart.toDateString()} to ${periodEnd.toDateString()}.

${profileLine}

Numbers from the past 7 days:
- Questions asked of Nagi: ${stats.questions_asked}
- Errors / things that broke: ${stats.errors}
- Times Nagi was offline: ${stats.offline_unavailable}
- Help requests sent to family: ${stats.help_requests_total} (${stats.help_requests_acknowledged} handled, ${stats.help_requests_pending} still pending)

What ${callName} actually asked Nagi about (most recent first):
${recentTurns || '(no questions this week)'}

Help requests this week:
${helpLines || '(none)'}

Write the digest in markdown, ~150-220 words. Open with one sentence about how the week felt. Then 2-4 short paragraphs covering: what they were curious about, where they got stuck, anything worth flagging to the family. Close with one practical suggestion if there's a clear one (e.g. "consider adding their medication schedule to the About profile"), otherwise just a warm sign-off.

Don't repeat the raw numbers — weave them in only when they help the story. Don't invent things that aren't in the data. Don't use emojis (this gets read aloud sometimes).`;

  // ── Call Claude ──────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: env.get('ANTHROPIC_API_KEY') ?? '' });

  let digestMarkdown = '';
  try {
    const response = await anthropic.messages.create(
      {
        // MODELS — change here when Anthropic releases a new version
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: 25_000 },
    );
    digestMarkdown = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    return jsonError(`Claude call failed: ${String(err)}`, 502);
  }

  return new Response(
    JSON.stringify({
      digest_markdown: digestMarkdown,
      period_start: periodStartIso,
      period_end: periodEndIso,
      stats,
    }),
    { headers: CORS },
  );
});
