import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import {
  createReminder,
  deleteReminder,
  listForElder,
  setReminderActive,
  type PillReminder,
} from '@/features/reminders';
import { getElder, type Elder } from '@/features/elders';

const DAYS_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function normalizeTime(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (h < 0 || h > 23 || mins < 0 || mins > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function timeShort(timeStr: string): string {
  // Postgres returns 'HH:MM:SS'. Strip trailing seconds for display.
  return timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;
}

function daysSummary(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map(d => DAYS_LABEL[d])
    .join(', ');
}

export default function ElderRemindersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [elder, setElder] = useState<Elder | null>(null);
  const [reminders, setReminders] = useState<PillReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: elderData }, list] = await Promise.all([
      getElder(id),
      listForElder(id),
    ]);
    setElder(elderData);
    setReminders(list);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!elder || loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Pressable className="mb-6" onPress={() => safeBack(`/(intermediary)/elders/${id}`)}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Pill reminders</Text>
        <Text className="text-gray-500 text-sm mb-6">
          A gentle pill on {elder.display_name.split(' ')[0]}'s home screen at the time you set.
          They can take it, snooze it, or skip — all are accepted warmly.
        </Text>

        {reminders.length === 0 ? (
          <View className="bg-surface-intermediary-raised rounded-2xl p-5 border border-gray-100 mb-4">
            <Text className="text-gray-500 text-sm">No reminders yet.</Text>
          </View>
        ) : (
          <View className="gap-3 mb-4">
            {reminders.map(r => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onToggleActive={async () => {
                  await setReminderActive(r.id, !r.active);
                  await load();
                }}
                onDelete={async () => {
                  await deleteReminder(r.id);
                  await load();
                }}
              />
            ))}
          </View>
        )}

        {showForm ? (
          <ReminderForm
            elderId={id}
            organizationId={elder.organization_id}
            onCancel={() => setShowForm(false)}
            onCreated={async () => {
              setShowForm(false);
              await load();
            }}
          />
        ) : (
          <Pressable
            className="bg-accent-600 rounded-2xl py-4 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            onPress={() => setShowForm(true)}
          >
            <Text className="text-paper font-semibold">+ Add a reminder</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReminderCard({
  reminder,
  onToggleActive,
  onDelete,
}: {
  reminder: PillReminder;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="font-semibold text-gray-900 text-base">{reminder.label}</Text>
          {reminder.notes ? (
            <Text className="text-gray-500 text-sm mt-0.5">{reminder.notes}</Text>
          ) : null}
        </View>
        <View
          className={`rounded-full px-2.5 py-0.5 ${
            reminder.active ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              reminder.active ? 'text-green-700' : 'text-gray-500'
            }`}
          >
            {reminder.active ? 'Active' : 'Paused'}
          </Text>
        </View>
      </View>

      <Text className="text-gray-700 text-sm">
        {reminder.times.map(timeShort).join(' · ')} — {daysSummary(reminder.days_of_week)}
      </Text>

      <View className="flex-row gap-2 mt-3">
        <Pressable
          className="flex-1 bg-gray-100 rounded-xl py-2 items-center"
          onPress={onToggleActive}
        >
          <Text className="text-gray-700 text-sm font-medium">
            {reminder.active ? 'Pause' : 'Resume'}
          </Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl py-2 items-center border border-red-200"
          onPress={onDelete}
        >
          <Text className="text-red-600 text-sm font-medium">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReminderForm({
  elderId,
  organizationId,
  onCancel,
  onCreated,
}: {
  elderId: string;
  organizationId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [timesText, setTimesText] = useState('08:00, 20:00');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedTimes = useMemo(() => {
    return timesText
      .split(',')
      .map(t => normalizeTime(t))
      .filter((t): t is string => t !== null);
  }, [timesText]);

  const toggleDay = (d: number) => {
    setDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  };

  const handleSave = async () => {
    setError(null);
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('A label like "Metformin 500mg" helps the elder recognize the pill.');
      return;
    }
    if (parsedTimes.length === 0) {
      setError('Add at least one time, like "08:00".');
      return;
    }
    if (days.length === 0) {
      setError('Pick at least one day of the week.');
      return;
    }
    setBusy(true);
    const result = await createReminder({
      elder_id: elderId,
      organization_id: organizationId,
      label: trimmedLabel,
      notes: notes.trim() || null,
      times: parsedTimes,
      days_of_week: days,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save just now. Try again.');
      return;
    }
    onCreated();
  };

  return (
    <View className="bg-surface-intermediary-raised rounded-2xl p-5 border border-gray-100 gap-4">
      <View>
        <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Label</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
          placeholder="e.g. Metformin 500mg"
          placeholderTextColor="#9ca3af"
          value={label}
          onChangeText={setLabel}
          editable={!busy}
        />
      </View>

      <View>
        <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
          Notes (optional)
        </Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
          placeholder="e.g. with breakfast, shake the bottle"
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
          editable={!busy}
        />
      </View>

      <View>
        <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">
          Times (comma-separated, 24h)
        </Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
          placeholder="08:00, 20:00"
          placeholderTextColor="#9ca3af"
          value={timesText}
          onChangeText={setTimesText}
          editable={!busy}
          autoCapitalize="none"
        />
        {timesText.trim() && parsedTimes.length === 0 ? (
          <Text className="text-amber-700 text-xs mt-1 ml-1">
            Use HH:MM format, like 08:00.
          </Text>
        ) : null}
      </View>

      <View>
        <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">Days</Text>
        <View className="flex-row gap-1.5">
          {DAYS_LABEL.map((label, i) => {
            const on = days.includes(i);
            return (
              <Pressable
                key={i}
                onPress={() => toggleDay(i)}
                className={`flex-1 rounded-lg py-2 items-center ${
                  on ? 'bg-accent-500' : 'bg-gray-100'
                }`}
              >
                <Text className={`text-xs font-medium ${on ? 'text-paper' : 'text-gray-600'}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text className="text-red-700 text-sm">{error}</Text> : null}

      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
          onPress={onCancel}
          disabled={busy}
        >
          <Text className="text-gray-700 font-medium">Cancel</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-accent-600 rounded-xl py-3 items-center"
          onPress={handleSave}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-paper font-semibold">Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
