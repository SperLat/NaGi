import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import type { PillReminder, PillReminderEvent } from './types';

export interface CreatePillReminderInput {
  organization_id: string;
  elder_id: string;
  label: string;
  notes?: string | null;
  /** 'HH:MM' or 'HH:MM:SS' — Postgres `time[]` accepts either. */
  times: string[];
  days_of_week?: number[];
}

export async function listForElder(elderId: string): Promise<PillReminder[]> {
  if (isMock) return [];
  const { data } = await supabase
    .from('pill_reminders')
    .select('*')
    .eq('elder_id', elderId)
    .order('created_at', { ascending: false });
  return (data ?? []) as PillReminder[];
}

export async function listActiveForElder(elderId: string): Promise<PillReminder[]> {
  if (isMock) return [];
  const { data } = await supabase
    .from('pill_reminders')
    .select('*')
    .eq('elder_id', elderId)
    .eq('active', true);
  return (data ?? []) as PillReminder[];
}

export async function createReminder(
  input: CreatePillReminderInput,
): Promise<{ ok: boolean; error: string | null; reminder?: PillReminder }> {
  if (isMock) return { ok: true, error: null };

  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id;
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const payload = {
    organization_id: input.organization_id,
    elder_id: input.elder_id,
    label: input.label.trim(),
    notes: input.notes?.trim() || null,
    times: input.times,
    days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('pill_reminders')
    .insert(payload)
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null, reminder: data as PillReminder };
}

export async function updateReminder(
  id: string,
  patch: Partial<Pick<PillReminder, 'label' | 'notes' | 'times' | 'days_of_week' | 'active'>>,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase
    .from('pill_reminders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { ok: !error, error: error?.message ?? null };
}

export async function setReminderActive(
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  return updateReminder(id, { active });
}

export async function deleteReminder(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase.from('pill_reminders').delete().eq('id', id);
  return { ok: !error, error: error?.message ?? null };
}

/**
 * Insert (idempotent) a pending event for a scheduled slot. The slot
 * timestamp must be the *scheduled* time rounded to the minute, not
 * `now()`, so multiple inserts for the same slot collapse via the
 * unique (reminder_id, fired_at) index.
 */
export async function ensureEvent(
  reminder: PillReminder,
  scheduledAt: Date,
): Promise<{ ok: boolean; event: PillReminderEvent | null; error: string | null }> {
  if (isMock) return { ok: true, event: null, error: null };

  const firedAtIso = scheduledAt.toISOString();
  const { data: existing } = await supabase
    .from('pill_reminder_events')
    .select('*')
    .eq('reminder_id', reminder.id)
    .eq('fired_at', firedAtIso)
    .maybeSingle();
  if (existing) return { ok: true, event: existing as PillReminderEvent, error: null };

  const { data, error } = await supabase
    .from('pill_reminder_events')
    .insert({
      reminder_id: reminder.id,
      elder_id: reminder.elder_id,
      organization_id: reminder.organization_id,
      fired_at: firedAtIso,
      status: 'pending',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    // Unique-violation is fine — another tab beat us to the slot. Read it back.
    if (error.code === '23505') {
      const { data: row } = await supabase
        .from('pill_reminder_events')
        .select('*')
        .eq('reminder_id', reminder.id)
        .eq('fired_at', firedAtIso)
        .single();
      return { ok: true, event: row as PillReminderEvent, error: null };
    }
    return { ok: false, event: null, error: error.message };
  }
  return { ok: true, event: data as PillReminderEvent, error: null };
}

export async function getEvent(eventId: string): Promise<PillReminderEvent | null> {
  if (isMock) return null;
  const { data } = await supabase
    .from('pill_reminder_events')
    .select('*')
    .eq('id', eventId)
    .single();
  return (data as PillReminderEvent) ?? null;
}

export async function markTaken(
  eventId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase
    .from('pill_reminder_events')
    .update({ status: 'taken', acknowledged_at: new Date().toISOString() })
    .eq('id', eventId);
  return { ok: !error, error: error?.message ?? null };
}

export async function markSkipped(
  eventId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const { error } = await supabase
    .from('pill_reminder_events')
    .update({ status: 'skipped', acknowledged_at: new Date().toISOString() })
    .eq('id', eventId);
  return { ok: !error, error: error?.message ?? null };
}

export async function snoozeEvent(
  eventId: string,
  minutes: number,
): Promise<{ ok: boolean; error: string | null }> {
  if (isMock) return { ok: true, error: null };
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  const { error } = await supabase
    .from('pill_reminder_events')
    .update({ snoozed_until: until })
    .eq('id', eventId);
  return { ok: !error, error: error?.message ?? null };
}

/** Listing for the digest. Returns the past N days for an elder. */
export async function listEventsForElder(
  elderId: string,
  sinceIso: string,
): Promise<PillReminderEvent[]> {
  if (isMock) return [];
  const { data } = await supabase
    .from('pill_reminder_events')
    .select('*')
    .eq('elder_id', elderId)
    .gte('fired_at', sinceIso)
    .order('fired_at', { ascending: false });
  return (data ?? []) as PillReminderEvent[];
}
