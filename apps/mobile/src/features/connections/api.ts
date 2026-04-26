import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import type { ElderConnection, PendingElderConnection } from './types';

/**
 * List active connections for one of MY elders. Returns the rows
 * directly via the elder_connections RLS — caller sees connections
 * involving any elder in their org.
 */
export async function listConnectionsForElder(
  elderId: string,
): Promise<ElderConnection[]> {
  if (isMock) return [];

  const { data, error } = await supabase
    .from('elder_connections')
    .select('*')
    .or(`elder_a_id.eq.${elderId},elder_b_id.eq.${elderId}`)
    .order('proposed_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as ElderConnection[];
}

/** All connections in any state for the caller's org — useful for an admin-style view. */
export async function listMyConnections(): Promise<ElderConnection[]> {
  if (isMock) return [];
  const { data } = await supabase
    .from('elder_connections')
    .select('*')
    .order('proposed_at', { ascending: false });
  return (data ?? []) as ElderConnection[];
}

/**
 * Pending invites where I am the recipient (not the proposer).
 * Powered by the SECURITY DEFINER RPC in migration 0019.
 */
export async function listMyPendingElderConnections(): Promise<PendingElderConnection[]> {
  if (isMock) return [];
  const { data, error } = await supabase.rpc('list_my_pending_elder_connections');
  if (error) return [];
  return (data ?? []) as PendingElderConnection[];
}

/**
 * Propose a connection between two elders. The first id must be one
 * of MY elders; the second can be any other elder (cross-tenant).
 * Returns the connection id (existing or new — propose is upsert).
 */
export async function proposeElderConnection(
  myElderId: string,
  otherElderId: string,
): Promise<{ ok: true; connectionId: string } | { ok: false; error: string }> {
  if (isMock) return { ok: true, connectionId: 'mock-connection-id' };
  const { data, error } = await supabase.rpc('propose_elder_connection', {
    my_elder_id: myElderId,
    other_elder_id: otherElderId,
  });
  if (error || !data) return { ok: false, error: error?.message ?? 'Proposal failed' };
  return { ok: true, connectionId: data as string };
}

export async function respondToElderConnection(
  connectionId: string,
  accept: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase.rpc('respond_to_elder_connection', {
    connection_id: connectionId,
    accept,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/**
 * Find an elder by display name across orgs, for the proposal flow.
 *
 * Backed by the SECURITY DEFINER RPC find_elder_for_connection in
 * migration 0022, which bypasses RLS to enable cross-tenant discovery
 * (the whole point of "Friends across families"). The RPC requires
 * a min query length of 3 chars and excludes the caller's own orgs.
 * Privacy floor stays at the proposal step — the recipient family
 * still has to accept before any data flows.
 *
 * Returns at most 10 rows with just enough fields to disambiguate.
 */
export async function findElderByName(
  query: string,
): Promise<
  Array<{
    id: string;
    display_name: string;
    preferred_lang: string;
    organization_name: string;
  }>
> {
  const trimmed = query.trim();
  if (isMock || trimmed.length < 3) return [];
  const { data } = await supabase.rpc('find_elder_for_connection', {
    query: trimmed,
  });
  return (data ?? []) as Array<{
    id: string;
    display_name: string;
    preferred_lang: string;
    organization_name: string;
  }>;
}
