import { db } from '@/lib/supabase';
import { localDb } from '@/lib/db';
import { enqueueOutbox } from '@/lib/sync/outbox';
import { isMock } from '@/config/mode';
import type { Elder, CreateElderInput, UpdateElderInput } from './types';

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
