import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { relativeTime } from '@/lib/time';
import { listConversationTurns, type ConversationTurn } from '@/features/ai-chat';

/**
 * Read-only transcript of every elder ↔ Nagi exchange.
 *
 * The data has been there all along (activity_log rows with kind='ai_turn'
 * carry both halves of the turn in their payload) — until now the
 * intermediary just had no way to see it. The plan calls this "the most
 * useful grounding for what's on her mind right now": real words she
 * said, not summaries.
 *
 * Pagination is keyset on client_ts (cursor = oldest turn we have so
 * far). That stays correct even as new turns arrive at the head, which
 * an offset-based pager wouldn't.
 */

const PAGE_SIZE = 50;

type RangeKey = 'today' | '7d' | '30d' | 'all';

const RANGES: Array<{ key: RangeKey; label: string; hours: number | null }> = [
  { key: 'today', label: 'Today', hours: 24 },
  { key: '7d', label: '7 days', hours: 24 * 7 },
  { key: '30d', label: '30 days', hours: 24 * 30 },
  { key: 'all', label: 'All', hours: null },
];

export default function ElderConversations() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [range, setRange] = useState<RangeKey>('7d');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sinceTs = useMemo(() => {
    const hours = RANGES.find(r => r.key === range)?.hours ?? null;
    if (hours === null) return undefined;
    return new Date(Date.now() - hours * 3600_000).toISOString();
  }, [range]);

  const refresh = useCallback(async () => {
    const fresh = await listConversationTurns(id, { limit: PAGE_SIZE, sinceTs });
    setTurns(fresh);
    setHasMore(fresh.length >= PAGE_SIZE);
  }, [id, sinceTs]);

  useEffect(() => {
    setLoading(true);
    setExpanded({});
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || turns.length === 0) return;
    setLoadingMore(true);
    const oldest = turns[turns.length - 1].client_ts;
    const next = await listConversationTurns(id, {
      limit: PAGE_SIZE,
      beforeTs: oldest,
      sinceTs,
    });
    setTurns(prev => [...prev, ...next]);
    setHasMore(next.length >= PAGE_SIZE);
    setLoadingMore(false);
  }, [hasMore, id, loadingMore, sinceTs, turns]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-3 flex-row items-center">
        <Pressable onPress={() => safeBack(`/(intermediary)/elders/${id}`)} className="mr-4">
          <Text className="text-accent-600 font-medium">←</Text>
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Conversations</Text>
      </View>

      {/* Range picker */}
      <View className="px-6 pb-3 flex-row gap-2">
        {RANGES.map(r => {
          const active = r.key === range;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-full border ${
                active ? 'bg-accent-600 border-accent-600' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-700'}`}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#34503E" />
        </View>
      ) : (
        <FlatList
          data={turns}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center mt-2">
              <Text className="text-3xl mb-2">💬</Text>
              <Text className="text-gray-500 text-sm text-center">
                No conversations yet in this range.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#34503E" />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            // Private turn: show the timestamp + a quiet placeholder, never
            // the substance. The row is preserved (not filtered out) so the
            // family knows their elder had a moment with Nagi at this time —
            // honest about the boundary, opaque about the content.
            if (item.is_private) {
              return (
                <View className="mb-3">
                  <Text className="text-gray-400 text-xs mb-1 ml-1">
                    {relativeTime(item.client_ts)}
                  </Text>
                  <View className="bg-neutral-50 rounded-2xl px-4 py-3 border border-neutral-200 self-stretch">
                    <Text className="text-neutral-500 text-sm italic leading-snug">
                      A private moment
                    </Text>
                  </View>
                </View>
              );
            }

            const isExpanded = expanded[item.id] ?? false;
            const userTooLong = item.user_message.length > 280;
            const assistantTooLong = item.assistant_message.length > 400;
            const userText =
              isExpanded || !userTooLong ? item.user_message : item.user_message.slice(0, 280) + '…';
            const assistantText =
              isExpanded || !assistantTooLong
                ? item.assistant_message
                : item.assistant_message.slice(0, 400) + '…';

            return (
              <Pressable
                className="mb-3"
                onPress={() =>
                  setExpanded(prev => ({ ...prev, [item.id]: !(prev[item.id] ?? false) }))
                }
              >
                <Text className="text-gray-400 text-xs mb-1 ml-1">
                  {relativeTime(item.client_ts)}
                </Text>
                {item.user_message ? (
                  <View className="bg-accent-100 rounded-2xl rounded-tr-sm px-4 py-3 ml-8 mb-1.5">
                    <Text className="text-gray-900 text-sm leading-snug" selectable>
                      {userText}
                    </Text>
                  </View>
                ) : null}
                {item.assistant_message ? (
                  <View className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 mr-8 border border-gray-100">
                    <Text className="text-gray-800 text-sm leading-snug" selectable>
                      {assistantText}
                    </Text>
                  </View>
                ) : null}
                {(userTooLong || assistantTooLong) && !isExpanded ? (
                  <Text className="text-accent-600 text-xs mt-1 ml-1">Tap to expand</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
