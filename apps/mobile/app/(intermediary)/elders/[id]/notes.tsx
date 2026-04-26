import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { relativeTime } from '@/lib/time';
import { listElderNotes, postElderNote, deleteElderNote, type ElderNote } from '@/features/elder-notes';
import { useSession } from '@/state';

/**
 * Shared notes journal — chronological care-team feed for one elder.
 *
 * Different shape from the About profile (P11): About is static "how she
 * works"; notes are timestamped events ("Tuesday — doctor visit went
 * well"). Compose box at top, newest first below.
 *
 * Realtime is overkill here — caregivers don't expect every note to
 * appear instantly the way they do for help requests. Pull-to-refresh
 * is enough.
 */

function shortAuthor(email: string, isYou: boolean): string {
  if (isYou) return 'You';
  // Trim "name@host.tld" → "name" so the byline stays readable.
  return email.split('@')[0] || email;
}

export default function ElderNotes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrgId, userId } = useSession();
  const [notes, setNotes] = useState<ElderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const fresh = await listElderNotes(id);
    setNotes(fresh);
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onPost = useCallback(async () => {
    if (!body.trim() || !activeOrgId || !userId) return;
    setPosting(true);
    setError(null);
    const result = await postElderNote(id, activeOrgId, userId, body);
    setPosting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBody('');
    await refresh();
  }, [activeOrgId, body, id, refresh, userId]);

  const onDelete = useCallback(
    async (noteId: string) => {
      // RN web's Alert.alert is a no-op stub; use a confirm dialog there
      // so the action isn't silently lost.
      const confirmed =
        Platform.OS === 'web'
          ? typeof window !== 'undefined' && window.confirm('Delete this note?')
          : await new Promise<boolean>(resolve => {
              Alert.alert('Delete this note?', undefined, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ]);
            });
      if (!confirmed) return;
      // Optimistic remove — RLS will reject if not the author, in which
      // case the next refresh restores the note.
      setNotes(prev => prev.filter(n => n.id !== noteId));
      await deleteElderNote(noteId);
      await refresh();
    },
    [refresh],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-3 flex-row items-center">
        <Pressable onPress={() => safeBack(`/(intermediary)/elders/${id}`)} className="mr-4">
          <Text className="text-accent-600 font-medium">←</Text>
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Notes</Text>
      </View>

      {/* Compose box at top — fixed so it stays reachable while the list scrolls */}
      <View className="px-4 pb-3">
        <View className="bg-white rounded-2xl p-3 border border-gray-100">
          <TextInput
            className="text-gray-900 text-sm min-h-[60px]"
            multiline
            placeholder="Share what happened — a doctor visit, something she said, anything the care team should know."
            placeholderTextColor="#9ca3af"
            value={body}
            onChangeText={setBody}
            editable={!posting}
            textAlignVertical="top"
          />
          {error ? <Text className="text-red-600 text-xs mt-1">{error}</Text> : null}
          <View className="flex-row justify-end mt-2">
            <Pressable
              className={`rounded-xl px-4 py-2 ${body.trim() ? 'bg-accent-600' : 'bg-gray-200'}`}
              onPress={onPost}
              disabled={posting || !body.trim()}
            >
              {posting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={`font-medium text-sm ${body.trim() ? 'text-white' : 'text-gray-400'}`}>
                  Post note
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#34503E" />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="bg-white rounded-2xl p-6 border border-gray-100 items-center mt-2">
              <Text className="text-3xl mb-2">📓</Text>
              <Text className="text-gray-500 text-sm text-center">
                No notes yet.{'\n'}Be the first to share what's happening.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isYou = item.author_id === userId;
            return (
              <View className="bg-white rounded-2xl px-4 py-3 border border-gray-100 mb-2">
                <View className="flex-row items-baseline justify-between mb-1">
                  <Text className="text-xs font-semibold text-gray-700">
                    {shortAuthor(item.author_email, isYou)}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[11px] text-gray-400">
                      {relativeTime(item.occurred_at)}
                    </Text>
                    {isYou ? (
                      <Pressable onPress={() => onDelete(item.id)}>
                        <Text className="text-[11px] text-gray-300">✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Text className="text-gray-800 text-sm leading-snug" selectable>
                  {item.body}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
