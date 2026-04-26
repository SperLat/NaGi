import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { relativeTime } from '@/lib/time';
import { listActivity, type ActivityLog } from '@/features/activity-log';
import { pullActivityLog } from '@/lib/sync';
import { useSession } from '@/state';
import { isMock } from '@/config/mode';

const KIND_ICON: Record<string, string> = {
  ai_turn: '🤖',
  ui_action: '👆',
  error: '⚠️',
  offline_ai_unavailable: '📵',
};

function summaryText(entry: ActivityLog): string {
  const p = entry.payload;
  if (entry.kind === 'ai_turn') return String(p.message ?? '…').slice(0, 60);
  if (entry.kind === 'ui_action') return String(p.action ?? '…');
  if (entry.kind === 'error') return String(p.message ?? p.code ?? 'Error');
  if (entry.kind === 'offline_ai_unavailable') return 'AI unavailable — offline';
  return '';
}

export default function ElderActivity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrgId } = useSession();
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await listActivity(id);
    setEntries(data);
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!isMock && activeOrgId) {
      await pullActivityLog(activeOrgId);
    }
    await load();
    setRefreshing(false);
  }, [activeOrgId, load]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-4 flex-row items-center">
        <Pressable onPress={() => safeBack(`/(intermediary)/elders/${id}`)} className="mr-4">
          <Text className="text-accent-600 font-medium">←</Text>
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Activity log</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#34503E" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="bg-surface-intermediary-raised rounded-2xl p-6 border border-gray-100 items-center mt-2">
              <Text className="text-3xl mb-2">📭</Text>
              <Text className="text-gray-500 text-sm text-center">
                No activity yet.{'\n'}Pull to refresh after they use the app.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-surface-intermediary-raised rounded-2xl px-4 py-3 border border-gray-100 mb-2 flex-row items-start">
              <Text className="text-2xl mr-3 mt-0.5">{KIND_ICON[item.kind] ?? '📋'}</Text>
              <View className="flex-1">
                <Text className="text-gray-900 text-sm leading-snug">{summaryText(item)}</Text>
                <Text className="text-gray-400 text-xs mt-1">{relativeTime(item.client_ts)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
