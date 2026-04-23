// Help request API — writes go through the outbox for offline resilience.
//
// SAFETY INVARIANT: createHelpRequest() always resolves immediately.
// The op is enqueued locally and drained when connectivity returns.
// The elder NEVER sees a failure or "queued" state — calm UX is preserved.

import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import { enqueue } from '@/features/outbox/enqueue';
import type { HelpRequest } from './types';

/**
 * Elder tapped "Necesito Ayuda" — enqueue a help request immediately.
 * Always resolves (never throws from the caller's perspective): the elder
 * sees success even offline, and the intermediary receives the row via
 * Supabase Realtime once the drain succeeds.
 */
export async function createHelpRequest(
  elderId: string,
  organizationId: string,
): Promise<void> {
  if (isMock) return;
  await enqueue({
    kind: 'help_request',
    payload: {
      elder_id: elderId,
      organization_id: organizationId,
    },
  });
}

/**
 * Intermediary acknowledges a request — marks it resolved so the badge clears.
 */
export async function acknowledgeHelpRequest(
  id: string,
  userId: string,
): Promise<void> {
  if (isMock) return;
  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Load all pending requests for an org, newest first, joined with elder name.
 */
export async function listPendingRequests(organizationId: string): Promise<HelpRequest[]> {
  if (isMock) return [];
  const { data, error } = await supabase
    .from('help_requests')
    .select('*, elders(display_name)')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    ...row,
    elder_name: row.elders?.display_name ?? 'Elder',
  }));
}
