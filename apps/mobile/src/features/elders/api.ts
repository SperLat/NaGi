import { db, supabase } from '@/lib/supabase';
import { localDb } from '@/lib/db';
import { enqueueOutbox } from '@/lib/sync/outbox';
import { isMock } from '@/config/mode';
import type {
  Elder,
  CreateElderInput,
  UpdateElderInput,
  ElderIntermediary,
  InviteIntermediaryResult,
  PendingInvitation,
} from './types';

// SQLite stores profile/ui_config as JSON text — parse on read.
function parseRow(row: Record<string, unknown>): Elder {
  return {
    ...(row as unknown as Elder),
    profile: JSON.parse((row.profile as string) || '{}'),
    ui_config: JSON.parse((row.ui_config as string) || '{}'),
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function listElders(
  organizationId: string,
): Promise<{ data: Elder[]; error: null }> {
  if (isMock || !localDb) {
    return db.from<Elder>('elders').select('*').eq('organization_id', organizationId);
  }
  const rows = localDb.getAllSync<Record<string, unknown>>(
    "SELECT * FROM elders WHERE organization_id = ? AND status != 'archived' ORDER BY display_name ASC",
    [organizationId],
  );
  return { data: rows.map(parseRow), error: null };
}

export async function getElder(id: string): Promise<{ data: Elder | null; error: null }> {
  if (isMock || !localDb) {
    return db.from<Elder>('elders').select('*').eq('id', id).single();
  }
  const row = localDb.getFirstSync<Record<string, unknown>>(
    'SELECT * FROM elders WHERE id = ?',
    [id],
  );
  return { data: row ? parseRow(row) : null, error: null };
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createElder(
  input: CreateElderInput,
): Promise<{ data: Elder; error: null }> {
  // Language-appropriate default offline message — shown when the AI is unreachable.
  // Intermediaries can override this with a personal message in the configure screen.
  const DEFAULT_OFFLINE: Record<string, string> = {
    es: 'Ahora mismo no puedo responder. Llama a tu familia si necesitas ayuda.',
    pt: 'Não consigo responder agora. Ligue para sua família se precisar de ajuda.',
    en: 'I cannot respond right now. Call your family if you need help.',
  };

  const lang = input.preferred_lang ?? 'es';
  const now = new Date().toISOString();
  const elder: Elder = {
    id: crypto.randomUUID(),
    organization_id: input.organization_id,
    display_name: input.display_name,
    preferred_lang: lang,
    profile: {},
    profile_version: 1,
    ui_config: {
      home_cards: ['call_family', 'get_help', 'my_day', 'one_task'],
      offline_message: DEFAULT_OFFLINE[lang] ?? DEFAULT_OFFLINE.en,
      text_size: 'xl',
      high_contrast: false,
      voice_input: true,
    },
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  if (isMock || !localDb) {
    await db.from('elders').insert(elder as unknown as Record<string, unknown>);
  } else {
    localDb.runSync(
      `INSERT INTO elders
       (id, organization_id, display_name, preferred_lang, profile, profile_version,
        ui_config, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        elder.id,
        elder.organization_id,
        elder.display_name,
        elder.preferred_lang,
        JSON.stringify(elder.profile),
        elder.profile_version,
        JSON.stringify(elder.ui_config),
        elder.status,
        elder.created_at,
        elder.updated_at,
      ],
    );
    enqueueOutbox('elders', 'insert', elder as unknown as Record<string, unknown>);

  }

  return { data: elder, error: null };
}

export async function updateElder(
  id: string,
  patch: UpdateElderInput,
): Promise<{ data: Elder | null; error: null }> {
  const { data: existing } = await getElder(id);
  if (!existing) return { data: null, error: null };

  const bumpVersion =
    patch.profile !== undefined && patch.profile !== existing.profile;

  const updated: Elder = {
    ...existing,
    ...patch,
    // Structured ElderProfile lacks an index signature; widen for storage.
    profile: (patch.profile ?? existing.profile) as Record<string, unknown>,
    profile_version: bumpVersion ? existing.profile_version + 1 : existing.profile_version,
    updated_at: new Date().toISOString(),
  };

  if (isMock || !localDb) {
    await db
      .from('elders')
      .update({ ...(updated as unknown as Record<string, unknown>) })
      .eq('id', id);
  } else {
    localDb.runSync(
      `UPDATE elders SET
         display_name    = ?,
         preferred_lang  = ?,
         profile         = ?,
         profile_version = ?,
         ui_config       = ?,
         status          = ?,
         updated_at      = ?
       WHERE id = ?`,
      [
        updated.display_name,
        updated.preferred_lang,
        JSON.stringify(updated.profile),
        updated.profile_version,
        JSON.stringify(updated.ui_config),
        updated.status,
        updated.updated_at,
        id,
      ],
    );
    enqueueOutbox('elders', 'update', updated as unknown as Record<string, unknown>);
  }

  return { data: updated, error: null };
}

// ── Intermediary membership ──────────────────────────────────────────────────
// These go through SECURITY DEFINER RPCs (0009) because auth.users is not
// visible to the anon client. In mock mode we read/write the in-memory store
// directly and synthesise an email from the user_id.

export async function listIntermediaries(
  elderId: string,
): Promise<{ data: ElderIntermediary[]; error: string | null }> {
  if (isMock) {
    const { data } = await db
      .from<{
        elder_id: string;
        user_id: string;
        relation: string | null;
        created_at: string;
      }>('elder_intermediaries')
      .select('*')
      .eq('elder_id', elderId);

    const rows = (data ?? []).map(r => ({
      user_id: r.user_id,
      email:
        r.user_id === 'user-demo-0001'
          ? 'mock-intermediary@local'
          : `${r.user_id}@local`,
      relation: r.relation ?? null,
      created_at: r.created_at,
      // Mock store doesn't model the pending → accept flow; treat all
      // mock rows as already accepted so the UI doesn't show stale pills.
      accepted_at: r.created_at,
    }));
    return { data: rows, error: null };
  }

  const { data, error } = await supabase.rpc('list_elder_intermediaries', {
    elder: elderId,
  });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    user_id: r.user_id as string,
    email: r.email as string,
    relation: (r.relation as string | null) ?? null,
    created_at: r.created_at as string,
    accepted_at: (r.accepted_at as string | null) ?? null,
  }));
  return { data: rows, error: null };
}

export async function inviteIntermediary(
  elderId: string,
  email: string,
  relation: string,
): Promise<InviteIntermediaryResult> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedRelation = relation.trim();

  if (isMock) {
    // The mock store only has one known user (MOCK_USER). Any other email
    // falls through to "not_joined" — matching the real-backend UX.
    const known = trimmedEmail === 'mock-intermediary@local';
    if (!known) return { status: 'not_joined' };

    await db.from('elder_intermediaries').insert({
      elder_id: elderId,
      user_id: 'user-demo-0001',
      relation: trimmedRelation || null,
      created_at: new Date().toISOString(),
    });
    return { status: 'added', user_id: 'user-demo-0001' };
  }

  const { data, error } = await supabase.rpc('add_elder_intermediary', {
    elder: elderId,
    email: trimmedEmail,
    relation: trimmedRelation || null,
  });
  if (error) return { status: 'error', message: error.message };
  if (!data) return { status: 'not_joined' };
  return { status: 'added', user_id: data as string };
}

// ── Invitation acceptance (invitee side) ─────────────────────────────────
// Packet 4: invitees see pending offers on their dashboard and accept or
// decline. Accepting promotes the elder_intermediaries row AND grants the
// invitee membership in the elder's organization.

export async function listMyPendingInvitations(): Promise<{
  data: PendingInvitation[];
  error: string | null;
}> {
  if (isMock) {
    // Mock store doesn't model cross-user invitations — return empty.
    return { data: [], error: null };
  }

  const { data, error } = await supabase.rpc('list_my_pending_invitations');
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as PendingInvitation[], error: null };
}

export async function acceptInvitation(
  elderId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };

  const { error } = await supabase.rpc('accept_elder_intermediary', {
    elder: elderId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function declineInvitation(
  elderId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };

  const { error } = await supabase.rpc('decline_elder_intermediary', {
    elder: elderId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
