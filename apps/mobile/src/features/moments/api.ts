import { supabase } from '@/lib/supabase';
import { env } from '@/config/env';
import { isMock } from '@/config/mode';
import type { CreateMomentInput, ElderMoment } from './types';

export interface ListMomentsOpts {
  /** Inclusive lower bound on occurred_on (YYYY-MM-DD). */
  since?: string;
  /** Inclusive upper bound on occurred_on (YYYY-MM-DD). */
  until?: string;
  /** Hide private moments at the API layer (still readable for review screens). */
  publicOnly?: boolean;
  limit?: number;
}

export async function listMoments(
  elderId: string,
  opts: ListMomentsOpts = {},
): Promise<ElderMoment[]> {
  if (isMock) return [];
  let q = supabase
    .from('elder_moments')
    .select('*')
    .eq('elder_id', elderId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.since) q = q.gte('occurred_on', opts.since);
  if (opts.until) q = q.lte('occurred_on', opts.until);
  if (opts.publicOnly) q = q.eq('is_private', false);
  const { data } = await q;
  return (data ?? []) as ElderMoment[];
}

export async function createCaregiverMoment(
  input: CreateMomentInput,
): Promise<{ ok: boolean; error: string | null; moment?: ElderMoment }> {
  if (isMock) return { ok: true, error: null };

  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const payload = {
    organization_id: input.organization_id,
    elder_id: input.elder_id,
    body: input.body.trim(),
    kind: input.kind?.trim() || null,
    occurred_on: input.occurred_on,        // server defaults to CURRENT_DATE if undefined
    is_private: input.is_private ?? false,
    source: 'caregiver' as const,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('elder_moments')
    .insert(payload)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null, moment: data as ElderMoment };
}

export async function setMomentPrivate(
  id: string,
  isPrivate: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase
    .from('elder_moments')
    .update({ is_private: isPrivate })
    .eq('id', id);
  return { ok: !error, error: error?.message ?? null };
}

export async function deleteMoment(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase.from('elder_moments').delete().eq('id', id);
  return { ok: !error, error: error?.message ?? null };
}

/**
 * Record a Nagi-noticed moment via the record-moment edge function.
 * The function inserts with source='nagi' under service_role — direct
 * client inserts of source='nagi' are rejected by RLS by design.
 *
 * Best-effort: failures are silent. A missed moment is better than a
 * broken chat experience.
 */
export async function recordNagiMoment(
  elderId: string,
  body: string,
  opts: { kind?: string | null; isPrivate?: boolean; occurredOn?: string } = {},
): Promise<void> {
  if (isMock) return;
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return;

  await fetch(`${env.supabaseUrl}/functions/v1/record-moment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      elder_id: elderId,
      body,
      kind: opts.kind ?? null,
      is_private: opts.isPrivate === true,
      occurred_on: opts.occurredOn,
    }),
  }).catch(() => {});
}
