import { supabase } from '@/lib/supabase';
import { env } from '@/config/env';
import { isMock } from '@/config/mode';

/**
 * Right to erasure (GDPR Art. 17). Deletes the caller's auth.users row;
 * cascade rules propagate to user_profiles, user_kiosk_pins,
 * organization_members, elder_intermediaries, etc.
 *
 * After success the caller is signed out and their JWT is no longer
 * valid for any future request.
 */
export async function deleteMyAccount(): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, error: 'Not authenticated' };

  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/delete-my-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? `delete-my-account ${res.status}` };
    }
    // Sign the caller out locally so the dead JWT is purged.
    await supabase.auth.signOut().catch(() => {});
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Right to data portability (GDPR Art. 20). Triggers a JSON download of
 * every record the caller can read. The browser saves the file directly
 * via the function's Content-Disposition header.
 */
export async function exportMyData(): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, error: 'Not authenticated' };

  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/export-my-data`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, error: errBody || `export-my-data ${res.status}` };
    }
    // Trigger browser download — works on web; on native this would
    // need expo-file-system + Sharing.shareAsync, follow-up if needed.
    if (typeof window !== 'undefined' && typeof URL !== 'undefined') {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nagi-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
