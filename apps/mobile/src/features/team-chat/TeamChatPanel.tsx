import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';
import { relativeTime } from '@/lib/time';
import {
  listTeamMessages,
  postTeamMessage,
  postTeamVoiceNote,
  getTeamVoiceNoteUrl,
  resolveTeamMessageAuthor,
  type TeamMessage,
} from '.';
import {
  startRecording,
  isSupported as recordingSupported,
  pickedExtension,
  type AudioRecorderHandle,
} from '@/lib/audio-recorder';
import {
  playAudioUrl,
  isPlaybackSupported,
  type PlaybackHandle,
} from '@/lib/audio-recorder/player';

interface TeamChatPanelProps {
  elderId: string;
  organizationId: string | null;
  userId: string | null;
}

function shortAuthor(email: string, isYou: boolean): string {
  if (isYou) return 'You';
  return email.split('@')[0] || email;
}

/**
 * Inline care-team chat for one elder. Lives on the elder overview as a
 * panel — not a separate screen — because team chat works best as
 * "always visible while you're looking at the elder," similar to
 * Slack-in-Linear or Notion-comments.
 *
 * Realtime: new INSERTs arrive without joined author email, so we patch
 * the row in place after a single resolver-RPC trip. Channel name
 * carries a random suffix to dodge supabase-js's by-name channel cache,
 * which bites in React 19 strict mode (cached, already-subscribed
 * channel rejects new .on() handlers — this is the same lesson learned
 * in the help-requests dashboard subscription).
 */
export function TeamChatPanel({ elderId, organizationId, userId }: TeamChatPanelProps) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorderHandle | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const refresh = useCallback(async () => {
    const fresh = await listTeamMessages(elderId);
    setMessages(fresh);
  }, [elderId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Realtime — INSERTs only. We don't subscribe to UPDATE/DELETE
  // because the table doesn't allow either.
  useEffect(() => {
    if (isMock) return;
    const channelName = `elder-team-${elderId}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'elder_team_messages',
          filter: `elder_id=eq.${elderId}`,
        },
        async (payload: { new: Partial<TeamMessage> }) => {
          const row = payload.new;
          if (!row.id || !row.body || !row.created_at || !row.author_id) return;

          // Skip duplicates — our own optimistic insert path could lap
          // the realtime echo, depending on connectivity.
          setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [
            ...prev,
            {
              id: row.id!,
              body: row.body!,
              audio_path: row.audio_path ?? null,
              created_at: row.created_at!,
              author_id: row.author_id!,
              author_email: '',
            },
          ]));

          // Resolve email asynchronously — UI shows a placeholder for
          // a beat, then patches in the real attribution.
          const email = await resolveTeamMessageAuthor(row.id!);
          if (email) {
            setMessages(prev =>
              prev.map(m => (m.id === row.id ? { ...m, author_email: email } : m)),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [elderId]);

  // Auto-scroll to newest when messages change.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const onSend = useCallback(async () => {
    if (!body.trim() || !organizationId || !userId) return;
    setPosting(true);
    setError(null);
    const result = await postTeamMessage(elderId, organizationId, userId, body);
    setPosting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBody('');
    // Refresh once so we get the canonical row + email even if the
    // realtime echo hasn't arrived yet. The realtime handler is idempotent
    // on id, so a duplicate path is harmless.
    await refresh();
  }, [body, elderId, organizationId, refresh, userId]);

  const onStartVoice = useCallback(async () => {
    setError(null);
    try {
      recorderRef.current = await startRecording();
      setRecording(true);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    }
  }, []);

  const onStopAndSendVoice = useCallback(async () => {
    if (!recorderRef.current) return;
    const handle = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    setPosting(true);
    try {
      const blob = await handle.stop();
      const ext  = pickedExtension(blob);
      const result = await postTeamVoiceNote(elderId, blob, `voice.${ext}`);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await refresh();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setPosting(false);
    }
  }, [elderId, refresh]);

  const onCancelVoice = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const onPlayVoiceNote = useCallback(async (messageId: string) => {
    playbackRef.current?.stop();
    setPlayingId(messageId);
    const url = await getTeamVoiceNoteUrl(messageId);
    if (!url) {
      setPlayingId(null);
      return;
    }
    try {
      playbackRef.current = await playAudioUrl(url, () => {
        playbackRef.current = null;
        setPlayingId(null);
      });
    } catch {
      setPlayingId(null);
    }
  }, []);

  // Cleanup on unmount — release mic, stop playback. Same shape as
  // the elder messages screen.
  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      playbackRef.current?.stop();
    };
  }, []);

  return (
    <View className="bg-surface-intermediary-raised rounded-2xl border border-gray-100 overflow-hidden">
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center">
        <Text className="text-2xl mr-2">👥</Text>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">Care circle</Text>
          <Text className="text-gray-500 text-xs">Notes between you and the family</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ maxHeight: 320 }}
        contentContainerStyle={{ padding: 12 }}
      >
        {loading ? (
          <View className="items-center py-6">
            <ActivityIndicator color="#34503E" />
          </View>
        ) : messages.length === 0 ? (
          <Text className="text-gray-400 text-sm text-center py-6">
            No messages yet. Say hi to the team.
          </Text>
        ) : (
          messages.map(m => {
            const isYou = m.author_id === userId;
            return (
              <View key={m.id} className="mb-3">
                <View className="flex-row items-baseline mb-0.5">
                  <Text className="text-[11px] font-semibold text-gray-700 mr-2">
                    {shortAuthor(m.author_email, isYou)}
                  </Text>
                  <Text className="text-[10px] text-gray-400">{relativeTime(m.created_at)}</Text>
                </View>
                <View
                  className={`rounded-2xl px-3 py-2 ${isYou ? 'bg-accent-100 self-end' : 'bg-gray-100 self-start'}`}
                  style={{ maxWidth: '85%' }}
                >
                  {m.audio_path && isPlaybackSupported() ? (
                    <Pressable
                      onPress={() => onPlayVoiceNote(m.id)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' })}
                    >
                      <Text className="text-gray-900 text-sm">
                        {playingId === m.id ? '⏸ Playing…' : '▶ 🎙️ Voice note'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text className="text-gray-900 text-sm leading-snug" selectable>
                      {m.body}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View className="px-3 py-3 border-t border-gray-100">
        {error ? <Text className="text-red-600 text-xs mb-1.5">{error}</Text> : null}
        {recording && (
          <View className="flex-row items-center mb-2">
            <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
            <Text className="text-gray-700 text-xs">Recording voice note…</Text>
          </View>
        )}
        <View className="flex-row gap-2 items-end">
          <TextInput
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm bg-gray-50 min-h-[40px] max-h-[120px]"
            placeholder="Note for the family…"
            placeholderTextColor="#9ca3af"
            value={body}
            onChangeText={setBody}
            multiline
            editable={!posting && !recording}
          />
          {recordingSupported() && (
            recording ? (
              <>
                <Pressable
                  className="rounded-xl px-3 py-2 bg-gray-200"
                  onPress={onCancelVoice}
                  disabled={posting}
                >
                  <Text className="text-gray-600 text-sm font-medium">✕</Text>
                </Pressable>
                <Pressable
                  className="rounded-xl px-3 py-2 bg-red-600"
                  onPress={onStopAndSendVoice}
                  disabled={posting}
                >
                  {posting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-paper text-sm font-medium">■</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                className="rounded-xl px-3 py-2 bg-accent-100"
                onPress={onStartVoice}
                disabled={posting}
              >
                <Text className="text-accent-ink text-sm font-medium">🎙️</Text>
              </Pressable>
            )
          )}
          <Pressable
            className={`rounded-xl px-4 py-2 ${body.trim() && !recording ? 'bg-accent-600' : 'bg-gray-200'}`}
            onPress={onSend}
            disabled={posting || recording || !body.trim()}
          >
            {posting && !recording ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={`font-medium text-sm ${body.trim() && !recording ? 'text-paper' : 'text-gray-400'}`}>
                Send
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
