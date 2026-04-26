import { useEffect, useState } from 'react';
import { ensureEvent, listActiveForElder, listEventsForElder } from './api';
import type { PillReminder, PillReminderEvent } from './types';

const POLL_MS = 30_000;
/** A slot is "due" from its scheduled minute until this many minutes later. */
const DUE_WINDOW_MIN = 30;

interface DueState {
  reminder: PillReminder;
  event: PillReminderEvent;
}

/**
 * Parse a Postgres time string ('08:00:00' or '08:00') into a Date for
 * the same calendar day as `now`. Returns null if the format is wrong.
 */
function timeOnDay(timeStr: string, now: Date): Date | null {
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Find the most recent scheduled slot for a reminder that falls inside
 * the due window relative to `now`. Returns null if nothing is due.
 *
 * "Due" means: the scheduled time is in the past by less than
 * DUE_WINDOW_MIN, AND today is in days_of_week. We don't surface
 * tomorrow's slots — only the current one if it's still in window.
 */
function findDueSlot(reminder: PillReminder, now: Date): Date | null {
  const today = now.getDay();
  if (!reminder.days_of_week.includes(today)) return null;

  let best: Date | null = null;
  for (const t of reminder.times) {
    const slot = timeOnDay(t, now);
    if (!slot) continue;
    const diffMin = (now.getTime() - slot.getTime()) / 60_000;
    if (diffMin < 0 || diffMin > DUE_WINDOW_MIN) continue;
    // Pick the most recent slot still in window.
    if (!best || slot.getTime() > best.getTime()) best = slot;
  }
  return best;
}

/**
 * Polls active reminders for an elder and surfaces the most recent
 * scheduled slot that falls in the due window. Inserts the event row
 * idempotently. Returns null when nothing is currently due.
 *
 * The kiosk-always-on assumption: this only fires while the elder home
 * is mounted. Phase-2 cron will create events server-side.
 */
export function useDueReminder(elderId: string | null | undefined): DueState | null {
  const [state, setState] = useState<DueState | null>(null);

  useEffect(() => {
    if (!elderId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const reminders = await listActiveForElder(elderId);
        if (cancelled || reminders.length === 0) {
          if (!cancelled) setState(null);
          return;
        }
        const now = new Date();

        // First: catch any pending event whose snooze has just elapsed.
        // Without this, snoozing near the end of the 30-min slot window
        // would silently cancel the reminder — the slot would age past
        // DUE_WINDOW_MIN before the snooze ended, and findDueSlot would
        // return null. Brand stance is "never chased": a snooze must
        // honor itself.
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const recentEvents = await listEventsForElder(elderId, todayStart.toISOString());
        const reminderById = new Map(reminders.map(r => [r.id, r]));
        const elapsedSnooze = recentEvents.find(e =>
          e.status === 'pending' &&
          reminderById.has(e.reminder_id) &&
          e.snoozed_until !== null &&
          new Date(e.snoozed_until) <= now
        );
        if (elapsedSnooze) {
          if (!cancelled) {
            setState({ reminder: reminderById.get(elapsedSnooze.reminder_id)!, event: elapsedSnooze });
          }
          return;
        }

        // Otherwise: for each active reminder, find a due slot and pick
        // the most recently scheduled one across all reminders.
        let pick: { reminder: PillReminder; scheduledAt: Date } | null = null;
        for (const r of reminders) {
          const slot = findDueSlot(r, now);
          if (!slot) continue;
          if (!pick || slot.getTime() > pick.scheduledAt.getTime()) {
            pick = { reminder: r, scheduledAt: slot };
          }
        }

        if (!pick) {
          if (!cancelled) setState(null);
          return;
        }

        const { event } = await ensureEvent(pick.reminder, pick.scheduledAt);
        if (cancelled) return;

        // Skip events that are already resolved or actively snoozed.
        if (!event || event.status !== 'pending') {
          setState(null);
          return;
        }
        if (event.snoozed_until && new Date(event.snoozed_until) > now) {
          setState(null);
          return;
        }

        setState({ reminder: pick.reminder, event });
      } catch {
        // Best-effort polling — failures don't block the home screen.
      }
    };

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [elderId]);

  return state;
}
