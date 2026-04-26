import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import {
  listUnreadForElder,
  ensureTranslation,
  markMessageRead,
  sendMessage,
  sendVoiceMessage,
  type ElderMessage,
} from '@/features/messages';
import { listConnectionsForElder } from '@/features/connections';
import { supabase } from '@/lib/supabase';
import {
  startRecording,
  isSupported as voiceRecordingSupported,
  pickedExtension,
  type AudioRecorderHandle,
} from '@/lib/audio-recorder';
import { useElderCtx } from './_layout';

interface DisplayMessage {
  id: string;
  connection_id: string;
  from_elder_id: string;
  from_elder_name: string;
  resolved_body: string;
  created_at: string;
}

/**
 * Cross-tenant message inbox for an elder. Lists unread messages from
 * any connected friend, plays them via TTS in the elder's preferred
 * language (translating on demand), and lets the elder send a reply
 * via voice or text — same speech pipeline the main chat uses.
 *
 * Intentionally a separate screen from chat: chat is a conversation
 * with Nagi, this is a relay between two elders. Different mental model.
 */
export default function ElderMessages() {
  const { elder } = useElderCtx();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [activeReplyTarget, setActiveReplyTarget] = useState<{
    connectionId: string;
    fromElderName: string;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorderHandle | null>(null);
  const spokeIdsRef = useRef<Set<string>>(new Set());

  const targetLang = elder?.preferred_lang ?? 'en';

  const refresh = useCallback(async () => {
    if (!elder) return;
    setLoading(true);
    const raw = await listUnreadForElder(elder.id);

    // Resolve each message's translated body (or fire translation if
    // missing) and the sender's display name.
    const resolved: DisplayMessage[] = [];
    for (const m of raw) {
      let body = (m.body_translated as Record<string, string>)?.[targetLang];
      if (!body) {
        // Fire translation; show original in the meantime.
        await ensureTranslation(m.id, targetLang);
        const { data } = await supabase
          .from('elder_messages')
          .select('body_translated, body')
          .eq('id', m.id)
          .single();
        body =
          (data as { body_translated?: Record<string, string>; body?: string } | null)
            ?.body_translated?.[targetLang] ??
          (data as { body?: string } | null)?.body ??
          m.body;
      }

      const { data: senderRow } = await supabase
        .from('elders')
        .select('display_name, profile')
        .eq('id', m.from_elder_id)
        .single();
      const senderProfile = (senderRow as { profile?: Record<string, unknown> } | null)?.profile;
      const preferredName =
        (senderProfile?.preferred_name as string | undefined) ??
        (senderRow as { display_name?: string } | null)?.display_name?.split(' ')[0] ??
        'A friend';

      resolved.push({
        id: m.id,
        connection_id: m.connection_id,
        from_elder_id: m.from_elder_id,
        from_elder_name: preferredName,
        resolved_body: body,
        created_at: m.created_at,
      });
    }

    setMessages(resolved);
    setLoading(false);
  }, [elder, targetLang]);

  useEffect(() => {
    void refresh();
    return () => { Speech.stop(); };
  }, [refresh]);

  // Auto-play newly-arrived messages once each (no replay loop).
  useEffect(() => {
    if (loading) return;
    for (const m of messages) {
      if (spokeIdsRef.current.has(m.id)) continue;
      spokeIdsRef.current.add(m.id);
      const phrase = `${m.from_elder_name} ${greetingFor(targetLang)}: ${m.resolved_body}`;
      Speech.speak(phrase, { language: speechLang(targetLang), rate: 0.88 });
      // Mark as read after speaking starts — the elder has experienced the content.
      void markMessageRead(m.id);
    }
  }, [messages, loading, targetLang]);

  const send = useCallback(async () => {
    if (!activeReplyTarget || !elder || !reply.trim()) return;
    setSending(true);
    const result = await sendMessage(
      activeReplyTarget.connectionId,
      elder.id,
      reply.trim(),
    );
    setSending(false);
    if (result.ok) {
      setReply('');
      setActiveReplyTarget(null);
      await refresh();
    }
  }, [activeReplyTarget, elder, refresh, reply]);

  // Start recording — opens mic, begins capturing. Errors (no mic,
  // permission denied) surface as recordError; the text input stays
  // available as the fallback.
  const startVoice = useCallback(async () => {
    setRecordError(null);
    try {
      const handle = await startRecording();
      recorderRef.current = handle;
      setRecording(true);
    } catch (err) {
      setRecordError(String((err as Error).message ?? err));
    }
  }, []);

  // Stop recording, upload to send-voice-message, refresh on success.
  // The recorder gives us a Blob in whatever MIME the browser chose;
  // we forward it as-is (Whisper handles webm/mp4/m4a/ogg/wav).
  const stopVoiceAndSend = useCallback(async () => {
    if (!activeReplyTarget || !elder || !recorderRef.current) return;
    const handle = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    setSending(true);
    try {
      const blob = await handle.stop();
      const ext  = pickedExtension(blob);
      const result = await sendVoiceMessage(
        activeReplyTarget.connectionId,
        elder.id,
        blob,
        `voice.${ext}`,
      );
      if (!result.ok) {
        setRecordError(result.error ?? 'Send failed');
        return;
      }
      setReply('');
      setActiveReplyTarget(null);
      await refresh();
    } catch (err) {
      setRecordError(String((err as Error).message ?? err));
    } finally {
      setSending(false);
    }
  }, [activeReplyTarget, elder, refresh]);

  const cancelVoice = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-elder">
      <View className="flex-1 px-6 pt-6">
        <Pressable
          onPress={() => { Speech.stop(); router.replace('/(elder)/'); }}
          className="self-start mb-4 px-2 py-1"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text className="text-accent-600 text-base font-medium">← {homeLabel(targetLang)}</Text>
        </Pressable>

        <Text className="text-3xl font-bold text-neutral-900 text-center mb-2">
          {inboxTitle(targetLang)}
        </Text>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#34503E" size="large" />
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-6xl mb-4">📭</Text>
            <Text className="text-lg text-neutral-500 text-center">
              {emptyLabel(targetLang)}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
            {messages.map(m => (
              <View
                key={m.id}
                className="bg-surface-elder-raised rounded-3xl p-5 mb-4 border border-accent-100"
              >
                <Text className="text-accent-700 text-sm font-semibold mb-2">
                  {m.from_elder_name}
                </Text>
                <Text className="text-neutral-800 text-xl leading-relaxed">
                  {m.resolved_body}
                </Text>

                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={() =>
                      Speech.speak(m.resolved_body, {
                        language: speechLang(targetLang),
                        rate: 0.88,
                      })
                    }
                    className="bg-accent-100 rounded-2xl py-3 px-5"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text className="text-accent-ink font-semibold text-base">
                      ▶ {playLabel(targetLang)}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Speech.stop();
                      setActiveReplyTarget({
                        connectionId: m.connection_id,
                        fromElderName: m.from_elder_name,
                      });
                    }}
                    className="bg-accent-600 rounded-2xl py-3 px-5 flex-1 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                  >
                    <Text className="text-paper font-semibold text-base">
                      {replyLabel(targetLang)} →
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {activeReplyTarget && (
          <View className="bg-surface-elder-raised rounded-3xl p-5 mb-4 border-2 border-accent-600">
            <Text className="text-accent-700 text-sm font-semibold mb-2">
              {replyToLabel(targetLang, activeReplyTarget.fromElderName)}
            </Text>
            <TextInput
              className="text-neutral-800 text-xl leading-relaxed min-h-[80px] mb-3"
              multiline
              placeholder={replyPlaceholder(targetLang)}
              placeholderTextColor="#9A9A95"
              value={reply}
              onChangeText={setReply}
              autoFocus={Platform.OS !== 'web' && !recording}
              editable={!recording && !sending}
              textAlignVertical="top"
            />

            {recordError ? (
              <Text className="text-red-600 text-sm mb-2">{recordError}</Text>
            ) : null}

            {recording && (
              <View className="flex-row items-center mb-3">
                <View className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                <Text className="text-neutral-700 text-base">{recordingLabel(targetLang)}</Text>
              </View>
            )}

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  if (recording) cancelVoice();
                  setActiveReplyTarget(null);
                  setReply('');
                  setRecordError(null);
                }}
                disabled={sending}
                className="border border-gray-200 rounded-2xl py-3 px-5"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-neutral-600 font-medium">{cancelLabel(targetLang)}</Text>
              </Pressable>

              {voiceRecordingSupported() && (
                recording ? (
                  <Pressable
                    onPress={stopVoiceAndSend}
                    disabled={sending}
                    className="bg-red-600 rounded-2xl py-3 px-5 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FAF5EC" />
                    ) : (
                      <Text className="text-paper font-semibold">■ {stopLabel(targetLang)}</Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={startVoice}
                    disabled={sending}
                    className="bg-accent-100 rounded-2xl py-3 px-5 items-center"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text className="text-accent-ink font-semibold">🎤 {recordLabel(targetLang)}</Text>
                  </Pressable>
                )
              )}

              <Pressable
                onPress={send}
                disabled={sending || recording || !reply.trim()}
                className="bg-accent-600 rounded-2xl py-3 px-5 flex-1 items-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                {sending && !recording ? (
                  <ActivityIndicator color="#FAF5EC" />
                ) : (
                  <Text className="text-paper font-semibold">{sendLabel(targetLang)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── i18n helpers (inline — kept here for the messaging surface) ────
// These could move into apps/mobile/src/lib/i18n.ts as a new section
// alongside ElderStrings, but they're scoped to this one route so
// keeping them local makes the screen self-contained.
function speechLang(code: string): string {
  return code === 'es' ? 'es' : code === 'pt' ? 'pt' : 'en-US';
}
function homeLabel(c: string)         { return c === 'es' ? 'Inicio'   : c === 'pt' ? 'Início'    : 'Home'; }
function inboxTitle(c: string)        { return c === 'es' ? 'Tus mensajes' : c === 'pt' ? 'Suas mensagens' : 'Your messages'; }
function emptyLabel(c: string)        { return c === 'es' ? 'No hay mensajes nuevos.' : c === 'pt' ? 'Sem mensagens novas.' : 'No new messages.'; }
function playLabel(c: string)         { return c === 'es' ? 'Escuchar' : c === 'pt' ? 'Ouvir'     : 'Listen'; }
function replyLabel(c: string)        { return c === 'es' ? 'Responder' : c === 'pt' ? 'Responder' : 'Reply'; }
function replyToLabel(c: string, n: string) { return c === 'es' ? `Responder a ${n}` : c === 'pt' ? `Responder a ${n}` : `Reply to ${n}`; }
function replyPlaceholder(c: string)  { return c === 'es' ? 'Escribe tu mensaje…' : c === 'pt' ? 'Escreva sua mensagem…' : 'Write your message…'; }
function cancelLabel(c: string)       { return c === 'es' ? 'Cancelar' : c === 'pt' ? 'Cancelar' : 'Cancel'; }
function sendLabel(c: string)         { return c === 'es' ? 'Enviar'   : c === 'pt' ? 'Enviar'   : 'Send'; }
function recordLabel(c: string)       { return c === 'es' ? 'Hablar'   : c === 'pt' ? 'Falar'    : 'Speak'; }
function stopLabel(c: string)         { return c === 'es' ? 'Enviar'   : c === 'pt' ? 'Enviar'   : 'Send'; }
function recordingLabel(c: string)    { return c === 'es' ? 'Grabando…' : c === 'pt' ? 'Gravando…' : 'Recording…'; }
function greetingFor(c: string)       { return c === 'es' ? 'te escribe' : c === 'pt' ? 'te escreve' : 'writes to you'; }
