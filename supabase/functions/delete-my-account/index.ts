// delete-my-account — GDPR Art. 17 right-to-erasure for the caller.
//
// Deletes auth.users for the caller. Cascade rules propagate:
//   - organization_members  → CASCADE
//   - elder_intermediaries  → CASCADE (caller stops being a caregiver)
//   - user_profiles         → CASCADE (display name gone)
//   - user_kiosk_pins       → CASCADE (PIN gone)
//   - elder_team_messages   → CASCADE (their care-circle posts gone)
//   - elder_messages.from_elder_id is on elders, not auth.users; unaffected
//   - help_requests.acknowledged_by → SET NULL (alert history retained,
//     attribution anonymized — defensible per GDPR's storage limitation
//     vs interest-of-other-data-subjects balancing)
//
// Elders that the caller was the SOLE intermediary on are NOT auto-deleted;
// the elder row persists with an empty intermediary set so other paths
// (org admin, future migration) can decide. This is the safe default — a
// caregiver leaving doesn't necessarily mean the elder's history should
// disappear.
//
// Auth: caller must be authenticated. Service-role does the deletion.

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('POST required', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return jsonError('Not authenticated', 401);

  const callerId = userRes.user.id;

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { error } = await adminClient.auth.admin.deleteUser(callerId);
  if (error) return jsonError(`Delete failed: ${error.message}`, 500);

  return new Response(JSON.stringify({ ok: true, deleted_user_id: callerId }), { headers: CORS });
});
