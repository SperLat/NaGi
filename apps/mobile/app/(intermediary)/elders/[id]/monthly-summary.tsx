import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { listMoments, type ElderMoment } from '@/features/moments';
import { getElder, type Elder } from '@/features/elders';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
function endOfMonth(year: number, month: number): string {
  const last = new Date(year, month + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function weekKey(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  // Anchor on the Monday of the week (ISO week start).
  const day = d.getDay();
  const offset = (day + 6) % 7; // 0 = Mon
  const monday = new Date(d.getTime() - offset * 86400000);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(mondayIso: string): string {
  const start = new Date(mondayIso + 'T00:00:00');
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function buildMarkdown(elderName: string, monthLabel: string, moments: ElderMoment[]): string {
  if (moments.length === 0) {
    return `# Proud moments — ${elderName}, ${monthLabel}\n\nA quiet month. That's its own kind of fine.`;
  }
  const byWeek = new Map<string, ElderMoment[]>();
  for (const m of moments) {
    const k = weekKey(m.occurred_on);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(m);
  }
  const sortedWeeks = [...byWeek.keys()].sort();
  const lines: string[] = [`# Proud moments — ${elderName}, ${monthLabel}`, ''];
  for (const wk of sortedWeeks) {
    lines.push(`## ${weekLabel(wk)}`);
    lines.push('');
    for (const m of byWeek.get(wk) ?? []) {
      const tag = m.kind ? ` _(${m.kind})_` : '';
      lines.push(`- ${m.body}${tag}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export default function MonthlySummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [elder, setElder] = useState<Elder | null>(null);
  const [moments, setMoments] = useState<ElderMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: elderData }, list] = await Promise.all([
      getElder(id),
      listMoments(id, {
        since: startOfMonth(year, month),
        until: endOfMonth(year, month),
        publicOnly: true,
        limit: 500,
      }),
    ]);
    setElder(elderData);
    setMoments(list);
    setLoading(false);
  }, [id, year, month]);

  useEffect(() => { void load(); }, [load]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const markdown = useMemo(
    () => buildMarkdown(elder?.display_name ?? '…', monthLabel, moments),
    [elder, monthLabel, moments],
  );

  const stepMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const handleCopy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    }
  };

  if (!elder || loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  const sortedWeeks = useMemo(() => {
    const byWeek = new Map<string, ElderMoment[]>();
    for (const m of moments) {
      const k = weekKey(m.occurred_on);
      if (!byWeek.has(k)) byWeek.set(k, []);
      byWeek.get(k)!.push(m);
    }
    return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [moments]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Pressable className="mb-6" onPress={() => safeBack(`/(intermediary)/elders/${id}/moments`)}>
          <Text className="text-accent-600 font-medium">← Back</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Proud moments</Text>
        <Text className="text-gray-500 text-sm mb-4">{elder.display_name}</Text>

        <View className="flex-row items-center justify-between mb-6 bg-surface-intermediary-raised border border-gray-100 rounded-2xl px-3 py-2">
          <Pressable onPress={() => stepMonth(-1)} className="px-3 py-2">
            <Text className="text-accent-600 font-medium">‹</Text>
          </Pressable>
          <Text className="font-semibold text-gray-900">{monthLabel}</Text>
          <Pressable onPress={() => stepMonth(1)} className="px-3 py-2">
            <Text className="text-accent-600 font-medium">›</Text>
          </Pressable>
        </View>

        {sortedWeeks.length === 0 ? (
          <View className="bg-surface-intermediary-raised rounded-2xl p-5 border border-gray-100 mb-4">
            <Text className="text-gray-700 leading-relaxed">
              A quiet month. That's its own kind of fine.
            </Text>
          </View>
        ) : (
          <View className="gap-4 mb-6">
            {sortedWeeks.map(([wk, list]) => (
              <View key={wk} className="bg-surface-intermediary-raised rounded-2xl p-4 border border-gray-100">
                <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {weekLabel(wk)}
                </Text>
                <View className="gap-2">
                  {list.map(m => (
                    <View key={m.id} className="flex-row">
                      <Text className="text-accent-500 mr-2">•</Text>
                      <Text className="flex-1 text-gray-800 leading-snug">
                        {m.body}
                        {m.kind ? <Text className="text-gray-400 italic"> ({m.kind})</Text> : null}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable
          className="bg-accent-600 rounded-2xl py-4 items-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          onPress={handleCopy}
        >
          <Text className="text-paper font-semibold">
            {copied ? 'Copied' : 'Copy as markdown'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
