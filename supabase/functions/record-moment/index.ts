// record-moment edge function — inserts an elder_moments row with
// source='nagi' on behalf of the chat client.
//
// The chat client parses a `[moment]{...}[/moment]` sentinel from
// Nagi's response (mirroring the existing `[private]` pattern) and
// posts the parsed payload here. RLS on elder_moments rejects
// source='nagi' inserts from regular auth contexts — only
// service_role can write them. This function runs as service_role
// and is the *only* path through which a Nagi-noticed moment is
// recorded, which is exactly the intent: the family cannot spoof an
// "AI noticed" moment by inserting directly.
//
// Auth posture: the caller must be an org member of the elder's org.
// We verify the JWT and re-check membership before inserting.

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

interface RecordMomentBody {
  elder_id?: string;
  body?: string;
  kind?: string | null;
  is_private?: boolean;
  occurred_on?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: RecordMomentBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { elder_id, body: text, kind, is_private, occurred_on } = body;
  if (!elder_id) return jsonError('elder_id required', 400);
  const trimmed = (text ?? '').trim();
  if (!trimmed) return jsonError('body required', 400);
  if (trimmed.length > 2000) return jsonError('body too long', 400);

  const auth = await verifyAndCheckMembership(req, elder_id);
  if ('error' in auth) return jsonError(auth.error, 401);

  const db = createClient(
    env.get('SUPABASE_URL') ?? '',
    env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const cleanedKind =
    typeof kind === 'string' && kind.trim() ? kind.trim().slice(0, 60) : null;

  const { data, error } = await db
    .from('elder_moments')
    .insert({
      elder_id,
      organization_id: auth.organizationId,
      body: trimmed,
      kind: cleanedKind,
      is_private: is_private === true,
      source: 'nagi',
      created_by: null,
      occurred_on: occurred_on || undefined,
    })
    .select('id, elder_id, body, kind, is_private, source, occurred_on, created_at')
    .single();

  if (error) return jsonError(`Insert failed: ${error.message}`, 500);
  return new Response(JSON.stringify({ ok: true, moment: data }), { headers: CORS });
});
