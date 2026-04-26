import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  updated_at: string;
}

/**
 * Read the caller's own profile, or null if no row exists yet.
 * No-op in mock mode (returns null).
 */
export async function getMyProfile(): Promise<UserProfile | null> {
  if (isMock) return null;
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userRes.user.id)
    .maybeSingle();
  return (data as UserProfile | null) ?? null;
}

/**
 * Upsert the caller's display name. Empty string clears it (falls
 * through to email-split). Returns the updated row on success.
 */
export async function setMyDisplayName(
  displayName: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return { ok: false, error: 'Not authenticated' };

  const trimmed = displayName.trim();
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userRes.user.id,
        display_name: trimmed.length > 0 ? trimmed : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/**
 * Resolve a display name for any user via the SECURITY DEFINER RPC.
 * Returns the user's chosen display_name if set, else the email handle
 * (everything before @), else 'someone'. Used by the care-circle and
 * digest attribution paths so the fallback rule lives in one place.
 */
export async function resolveDisplayName(userId: string): Promise<string> {
  if (isMock) return 'You';
  const { data } = await supabase.rpc('resolve_user_display_name', {
    target_user_id: userId,
  });
  if (typeof data === 'string') return data;
  return 'someone';
}
