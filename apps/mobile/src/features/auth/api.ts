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
  // orgName is preserved in the signature so callers don't need to change.
  // The org is now auto-created server-side via the auth.users insert
  // trigger (migration 0016) — orgName is used only as the display name
  // override stored in user metadata, which the user can rename later
  // from the organization screen.
  orgName: string,
): Promise<AuthResult> {
  if (isMock) return { success: true, error: null };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { intended_org_name: orgName },
    },
  });
  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Sign up failed' };
  }

  // The family organization is created by the auth.users INSERT trigger
  // (migration 0016 — auto_create_family_org_on_signup). The mobile
  // client no longer races against it. If email confirmation is OFF,
  // signUp returns a session immediately and getActiveOrg will find
  // the new row. If email confirmation is ON, the user confirms via
  // email, signs in, and getActiveOrg picks up the org on first sign-in.
  const orgId = await getActiveOrg(data.user.id);
  return { success: true, userId: data.user.id, orgId: orgId ?? undefined, error: null };
}

export async function signOut(): Promise<void> {
  if (isMock) return;
  await supabase.auth.signOut();
}
