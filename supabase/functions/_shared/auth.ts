import { createClient } from '@supabase/supabase-js';

type AuthSuccess = { userId: string; organizationId: string };
type AuthFailure = { error: string };

export async function verifyAndCheckMembership(
  req: Request,
  elderId: string,
): Promise<AuthSuccess | AuthFailure> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { error: 'Missing authorization header' };
  const token = auth.slice(7);

  const db = createClient(
    // deno-lint-ignore no-explicit-any
    (Deno as any).env.get('SUPABASE_URL') ?? '',
    // deno-lint-ignore no-explicit-any
    (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return { error: 'Invalid or expired token' };

  const { data: elder, error: elderError } = await db
    .from('elders')
    .select('organization_id')
    .eq('id', elderId)
    .single();

  if (elderError || !elder) return { error: 'Elder not found' };

  const { data: membership } = await db
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', (elder as { organization_id: string }).organization_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) return { error: 'Not authorized for this elder' };

  return { userId: user.id, organizationId: (elder as { organization_id: string }).organization_id };
}
