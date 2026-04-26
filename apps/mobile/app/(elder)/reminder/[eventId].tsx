import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { logActivity } from '@/features/activity-log';
import {
  getEvent,
  markSkipped,
  markTaken,
  snoozeEvent,
  type PillReminderEvent,
} from '@/features/reminders';
import { supabase } from '@/lib/supabase';
import { useStrings } from '@/lib/i18n';
import { useElderCtx } from '../_layout';

const SNOOZE_MINUTES = 10;

const TEXT_CLASS = {
  lg:  { heading: 'text-3xl', label: 'text-xl', btn: 'text-2xl' },
  xl:  { heading: 'text-4xl', label: 'text-2xl', btn: 'text-3xl' },
  '2xl': { heading: 'text-5xl', label: 'text-3xl', btn: 'text-4xl' },
};

export default function ReminderEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { elder, textSize, highContrast, orgId } = useElderCtx();
  const s = useStrings(elder?.preferred_lang);
  const [event, setEvent] = useState<PillReminderEvent | null>(null);
  const [label, setLabel] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void getEvent(eventId).then(async (ev) => {
      if (cancelled || !ev) return;
      setEvent(ev);
      const { data } = await supabase
        .from('pill_reminders')
        .select('label')
        .eq('id', ev.reminder_id)
        .single();
      if (cancelled) return;
      setLabel((data as { label?: string } | null)?.label ?? '');
    });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!eventId || !elder) {
    return (
      <SafeAreaView className="flex-1 bg-surface-elder-raised items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  const tc = TEXT_CLASS[textSize];
  const bg = highContrast ? 'bg-charcoal-deep' : 'bg-surface-elder-raised';
  const textColor = highContrast ? 'text-paper' : 'text-gray-900';

  const finishWith = async (
    action: 'taken' | 'skipped' | 'snoozed',
    op: () => Promise<{ ok: boolean; error: string | null }>,
  ) => {
    if (busy || !event) return;
    setBusy(true);
    const result = await op();
    if (elder && orgId) {
      void logActivity(elder.id, orgId, 'ui_action', {
        action: `pill_${action}`,
        screen: 'reminder',
        reminder_id: event.reminder_id,
        event_id: event.id,
        label,
      });
    }
    setBusy(false);
    if (result.ok) router.replace('/(elder)/');
  };

  return (
    <SafeAreaView
      className={`flex-1 ${bg}`}
      style={{ backgroundColor: highContrast ? '#0F0F0F' : '#FAF5EC' }}
    >
      <View className="flex-1 px-6 pt-12 pb-8 justify-between">
        <View>
          <Text className="text-7xl text-center mb-6">💊</Text>
          <Text className={`${tc.heading} font-bold ${textColor} text-center mb-3`}>
            {s.pillReminderTitle}
          </Text>
          {label ? (
            <Text className={`${tc.label} ${textColor} text-center mb-6`}>
              {label}
            </Text>
          ) : null}
          <Text className={`${tc.label} text-accent-700 text-center`}>
            {s.pillReminderQuestion}
          </Text>
        </View>

        <View className="gap-4">
          <Pressable
            onPress={() => finishWith('taken', () => markTaken(event!.id))}
            disabled={busy}
            className="bg-accent-500 rounded-2xl py-6 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className={`text-paper font-bold ${tc.btn}`}>{s.pillTookIt}</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              finishWith('snoozed', () => snoozeEvent(event!.id, SNOOZE_MINUTES))
            }
            disabled={busy}
            className="bg-accent-100 rounded-2xl py-5 items-center border-2 border-accent-500"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className={`text-accent-ink font-semibold ${tc.label}`}>
              {s.pillLater}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => finishWith('skipped', () => markSkipped(event!.id))}
            disabled={busy}
            className="rounded-2xl py-4 items-center border border-gray-300"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className={`${textColor} ${tc.label}`}>
              {s.pillSkipped}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
