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

/**
 * Returns the user's active org, creating one on the fly if missing.
 *
 * Self-heal path for sessions hydrated before the family-org backfill
 * (migration 0016) ran — e.g. moonlightrosita whose auth.users row
 * predated the trigger. If getActiveOrg returns null AND the user is
 * signed in (auth.uid() will be populated), we call the legacy
 * create_family_org RPC to provision one. RPC needs auth.uid() set,
 * which it is at this call site (we're in the signed-in dashboard
 * context — different from the post-signUp window where the bug
 * originally bit).
 */
export async function ensureActiveOrg(
  userId: string,
): Promise<{ ok: true; orgId: string } | { ok: false; orgId?: undefined; error: string }> {
  const existing = await getActiveOrg(userId);
  if (existing) return { ok: true, orgId: existing };
  if (isMock) return { ok: false, error: 'No org in mock mode' };

  // Derive a safe slug from the user's email — same logic the trigger
  // uses, just running from the client side as a fallback.
  const { data: userResult } = await supabase.auth.getUser();
  const email = userResult?.user?.email ?? '';
  const local = email.split('@')[0] || userId.slice(0, 8);
  const slug = `${local.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const orgName = email ? `${local}'s family` : 'My family';

  const { data: orgId, error } = await supabase.rpc('create_family_org', {
    org_name: orgName,
    org_slug: slug,
  });
  if (error || !orgId) {
    return { ok: false, error: error?.message ?? 'Could not create family org' };
  }
  return { ok: true, orgId: orgId as string };
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
