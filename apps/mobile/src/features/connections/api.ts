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
 * Find an elder by display name across the entire system. For demo
 * purposes only — production would have a search UI with consent
 * gates. Used by the "propose by name" form so a caregiver can find
 * Maggie Whitmore by typing the name without knowing the UUID.
 *
 * RLS limits results to elders in orgs the caller can see, BUT we
 * intentionally bypass that for connection proposals via a dedicated
 * SECURITY DEFINER RPC. For MVP, we use a plain SELECT — caregivers
 * can only propose to elders whose names they already know, and the
 * recipient still has to consent. Privacy floor is at the consent
 * step, not at discovery.
 */
export async function findElderByName(
  query: string,
): Promise<Array<{ id: string; display_name: string; preferred_lang: string }>> {
  if (isMock || !query.trim()) return [];
  // Note: this query runs with the caller's RLS — they can only see
  // elders in their own orgs. For cross-tenant discovery we'd need a
  // SECURITY DEFINER RPC. For demo we expect the caregiver to know
  // the exact display name and propose via that path.
  const { data } = await supabase
    .from('elders')
    .select('id, display_name, preferred_lang')
    .ilike('display_name', `%${query.trim()}%`)
    .limit(10);
  return (data ?? []) as Array<{ id: string; display_name: string; preferred_lang: string }>;
}
