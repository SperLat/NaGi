// ai-classify edge function — fast, non-streaming intent classification.
// Model: claude-haiku-4-5. Used for UI routing decisions on elder input.
// Returns: { intent: string, confidence: number }

import Anthropic from '@anthropic-ai/sdk';
import { verifyAndCheckMembership } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// deno-lint-ignore no-explicit-any
const Deno_ = Deno as any;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTENTS = ['call_family', 'get_help', 'my_day', 'one_task', 'emergency', 'unknown'] as const;
type Intent = (typeof INTENTS)[number];

const CLASSIFY_SYSTEM = `You classify elderly user messages into one of these intents:
- call_family: wants to call or contact family/friends
- get_help: needs help with something, or confused
- my_day: asking about schedule, weather, time, or daily activities
- one_task: wants to complete a specific task (not calling someone)
- emergency: expressing distress, pain, or urgency
- unknown: does not match any of the above

Respond ONLY with a JSON object: {"intent": "<one of the intents>", "confidence": <0.0-1.0>}
No other text.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: { elder_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  const { elder_id, message } = body;
  if (!elder_id || !message) {
    return new Response(JSON.stringify({ error: 'elder_id and message required' }), {
      status: 400,
      headers: CORS,
    });
  }

  const authResult = await verifyAndCheckMembership(req, elder_id);
  if ('error' in authResult) {
    return new Response(JSON.stringify({ error: authResult.error }), { status: 401, headers: CORS });
  }

  if (!checkRateLimit(authResult.userId)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: CORS,
    });
  }

  const anthropic = new Anthropic({ apiKey: Deno_.env.get('ANTHROPIC_API_KEY') ?? '' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 64,
      system: CLASSIFY_SYSTEM,
      messages: [{ role: 'user', content: message }],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    let parsed: { intent?: string; confidence?: number };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      parsed = {};
    }

    const intent: Intent = INTENTS.includes(parsed.intent as Intent)
      ? (parsed.intent as Intent)
      : 'unknown';

    return new Response(
      JSON.stringify({ intent, confidence: parsed.confidence ?? 0.5 }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), intent: 'unknown', confidence: 0 }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
