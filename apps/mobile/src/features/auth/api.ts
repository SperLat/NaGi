import { db, supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import type { AuthResult } from './types';

export async function getActiveOrg(userId: string): Promise<string | null> {
  const { data } = await db
    .from<{ organization_id: string }>('organization_members')
    .select('organization_id')
    .eq('user_id', userId);
  return (data?.[0]?.organization_id as string) ?? null;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (isMock) return { success: true, error: null };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Sign in failed' };
  }
  const orgId = await getActiveOrg(data.user.id);
  return { success: true, userId: data.user.id, orgId: orgId ?? undefined, error: null };
}

export async function signUp(
  email: string,
  password: string,
  orgName: string,
): Promise<AuthResult> {
  if (isMock) return { success: true, error: null };

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Sign up failed' };
  }

  const slug = orgName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const { data: orgId, error: rpcError } = await supabase.rpc('create_family_org', {
    org_name: orgName,
    org_slug: slug,
  });
  if (rpcError) {
    return { success: false, error: rpcError.message };
  }

  return { success: true, userId: data.user.id, orgId: orgId as string, error: null };
}

export async function signOut(): Promise<void> {
  if (isMock) return;
  await supabase.auth.signOut();
}
