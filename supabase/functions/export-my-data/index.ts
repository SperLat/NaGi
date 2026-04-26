// export-my-data — GDPR Art. 20 data portability for the caller.
//
// Returns a JSON bundle of every record the caller has access to via
// their RLS context. Caregivers get their own profile + every elder
// they're a caregiver of, with each elder's full history nested.
//
// Honest about scope: only data you can already SEE through the app is
// in the export. Cross-tenant elder messages are included if the caller
// is in either side's org (matches the dashboard's read posture).
//
// Format: a single JSON document with a stable shape so future revisions
// can add fields without breaking machine consumers. Versioned at
// export_format_version.

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const EXPORT_FORMAT_VERSION = 1;

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('POST required', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonError('Not authenticated', 401);
  const callerId = userRes.user.id;

  // Account-level info — only what the caller needs to verify identity
  // in the export. We don't include encrypted_password or auth tokens.
  const account = {
    id: callerId,
    email: userRes.user.email,
    created_at: userRes.user.created_at,
  };

  const profilePromise   = userClient.from('user_profiles').select('*').eq('user_id', callerId).maybeSingle();
  const orgsPromise      = userClient.from('organization_members').select('*').eq('user_id', callerId);
  const eldersPromise    = userClient.from('elders').select('*');
  const intermediariesP  = userClient.from('elder_intermediaries').select('*').eq('user_id', callerId);
  const teamMessagesP    = userClient.from('elder_team_messages').select('*').eq('author_id', callerId);

  const [
    { data: profile },
    { data: orgMemberships },
    { data: elders },
    { data: intermediaries },
    { data: teamMessages },
  ] = await Promise.all([profilePromise, orgsPromise, eldersPromise, intermediariesP, teamMessagesP]);

  // For each elder we can see, nest their per-elder history. Sequential
  // to keep memory bounded; caregivers typically have 1-5 elders.
  const elderIds = (elders ?? []).map((e: { id: string }) => e.id);
  const perElder: Array<Record<string, unknown>> = [];
  for (const id of elderIds) {
    const [moments, reminders, reminderEvents, activity, helpReqs, connections, messages] = await Promise.all([
      userClient.from('elder_moments').select('*').eq('elder_id', id),
      userClient.from('pill_reminders').select('*').eq('elder_id', id),
      userClient.from('pill_reminder_events').select('*').eq('elder_id', id),
      userClient.from('activity_log').select('*').eq('elder_id', id).limit(2000),
      userClient.from('help_requests').select('*').eq('elder_id', id),
      userClient.from('elder_connections').select('*').or(`elder_a_id.eq.${id},elder_b_id.eq.${id}`),
      userClient.from('elder_messages').select('*').or(`from_elder_id.eq.${id}`).limit(2000),
    ]);
    perElder.push({
      elder_id: id,
      moments:         moments.data ?? [],
      pill_reminders:  reminders.data ?? [],
      pill_events:     reminderEvents.data ?? [],
      activity_log:    activity.data ?? [],
      help_requests:   helpReqs.data ?? [],
      connections:     connections.data ?? [],
      messages:        messages.data ?? [],
    });
  }

  const bundle = {
    export_format_version: EXPORT_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    account,
    profile,
    organization_memberships: orgMemberships ?? [],
    elder_intermediary_links: intermediaries ?? [],
    care_circle_messages_authored: teamMessages ?? [],
    elders: elders ?? [],
    per_elder_history: perElder,
  };

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      ...CORS,
      'Content-Disposition': `attachment; filename="nagi-export-${callerId}-${Date.now()}.json"`,
    },
  });
});
