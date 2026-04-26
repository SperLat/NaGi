export interface PillReminder {
  id: string;
  organization_id: string;
  elder_id: string;
  label: string;
  notes: string | null;
  /** 'HH:MM:SS' strings as serialized by Postgres `time[]`. */
  times: string[];
  /** 0 = Sunday … 6 = Saturday. */
  days_of_week: number[];
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PillReminderEvent {
  id: string;
  reminder_id: string;
  elder_id: string;
  organization_id: string;
  fired_at: string;
  acknowledged_at: string | null;
  snoozed_until: string | null;
  status: 'pending' | 'taken' | 'skipped';
  created_at: string;
}

export interface DueReminderSlot {
  reminder: PillReminder;
  /** ISO timestamp for the scheduled minute. Used as the event's fired_at. */
  fired_at: string;
}

export interface DueReminderState {
  /** The reminder + event to surface on the kiosk pill, or null. */
  due: { reminder: PillReminder; event: PillReminderEvent } | null;
}
