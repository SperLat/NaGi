import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/nav';
import { useSession, selectActiveElderId } from '@/state';
import * as Speech from 'expo-speech';
import { startListening, isSupported } from '@/lib/voice';
import { sendChatMessage, loadChatHistory, type ChatMessage } from '@/features/ai-chat';
import { logActivity } from '@/features/activity-log';
import { createHelpRequest } from '@/features/help-request';
import { useStrings } from '@/lib/i18n';
import { useElderCtx } from './_layout';

const TEXT_CLASS = {
  lg:    { body: 'text-lg',  input: 'text-lg',  btn: 'text-xl' },
  xl:    { body: 'text-xl',  input: 'text-xl',  btn: 'text-2xl' },
  '2xl': { body: 'text-2xl', input: 'text-2xl', btn: 'text-3xl' },
};

interface DisplayMsg {
  id: string;
  role: 'user' | 'assistant' | 'streaming';
  content: string;
}

type CardKey = keyof ReturnType<typeof useStrings>['cards'];

const KNOWN_CARDS: ReadonlyArray<CardKey> = [
  'call_family', 'get_help', 'my_day', 'one_task', 'pastimes', 'proud_moments',
];

export default function ElderChat() {
  const { elder, textSize, highContrast, orgId } = useElderCtx();
  // Use the centralized selector — chat used to read activeElderId
  // alone, which silently bounced kiosk-mode users to intermediary
  // because their elder id lives on deviceMode, not activeElderId.
  const elderId = useSession(selectActiveElderId);
  const s = useStrings(elder?.preferred_lang);
  // The home tile that opened this chat passes its key. We use it to
  // render the per-tile welcome banner ("Share with me something
  // lovely…") so the elder lands with explicit framing instead of a
  // blank chat. Untyped param so we narrow against the known set.
  const params = useLocalSearchParams<{ cardKey?: string }>();
  const cardWelcome =
    params.cardKey && (KNOWN_CARDS as readonly string[]).includes(params.cardKey)
      ? s.cards[params.cardKey as CardKey].welcome
      : null;
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [display, setDisplay]     = useState<DisplayMsg[]>([]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [listening, setListening] = useState(false);
  const [volume, setVolume]       = useState(0);
  const [voiceMode, setVoiceMode] = useState(elder?.ui_config?.voice_input ?? true);
  const [ttsVoice, setTtsVoice]   = useState<string | undefined>(undefined);
  // Tracks the initial history fetch so the empty-state welcome doesn't
  // flash before Supabase responds. Stays true until loadChatHistory
  // resolves (or the effect tears down on elder change / unmount).
  const [historyLoading, setHistoryLoading] = useState(true);

  const streamRef      = useRef('');
  const listRef        = useRef<FlatList>(null);
  const inputRef       = useRef<TextInput>(null);
  const stopVoice      = useRef<(() => void) | null>(null);
  const handleSendRef  = useRef<(text: string) => void>(() => {});
  const silenceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tc = TEXT_CLASS[textSize];

  // Broad locale codes work more reliably across browsers than region variants
  const lang = elder?.preferred_lang === 'es' ? 'es'
    : elder?.preferred_lang === 'pt' ? 'pt'
    : 'en-US';

  // Pick the best available TTS voice for the elder's language.
  // Spanish: prefer LATAM locales over Spain Spanish.
  // Portuguese: prefer Brazilian (pt-BR) over European Portuguese.
  // English: explicitly pick en-US — on Spanish-locale LATAM devices the OS
  //          default voice is Spanish, so `voice: undefined` would speak English
  //          text with a Spanish accent even when language: 'en-US' is passed.
  // All: silent fallback to undefined (system default) if no match found.
  useEffect(() => {
    const lang = elder?.preferred_lang;
    if (!lang) return;

    // Web Speech API quirk: getVoices() returns [] on first call after a
    // cold browser process — voices populate asynchronously and the browser
    // fires 'voiceschanged' when the catalog is ready. Re-run the picker
    // on that event so a fresh page load doesn't get stuck on the OS
    // default voice (which is usually English on Windows = English engine
    // pronouncing Spanish text phonetically).
    const pickAndSetVoice = () => {
      Speech.getAvailableVoicesAsync().then(voices => {
        const pickFirst = (locales: string[]): string | undefined => {
          for (const locale of locales) {
            const v = voices.find(
              v => v.language === locale || v.identifier?.includes(locale.replace('-', '_')),
            );
            if (v) return v.identifier;
          }
          return undefined;
        };

        let voice: string | undefined;

        if (lang === 'es') {
          voice =
            pickFirst(['es-419', 'es-MX', 'es-US', 'es-AR', 'es-CO', 'es-CL']) ??
            voices.find(
              v =>
                (v.language ?? '').startsWith('es') &&
                !v.language?.startsWith('es-ES') &&
                !(v.identifier ?? '').includes('es_ES'),
            )?.identifier;
        } else if (lang === 'pt') {
          voice =
            pickFirst(['pt-BR', 'pt-PT']) ??
            voices.find(v => (v.language ?? '').startsWith('pt'))?.identifier;
        } else {
          // English (and any unrecognised lang) — prefer en-US
          voice =
            pickFirst(['en-US', 'en-GB', 'en-AU']) ??
            voices.find(v => (v.language ?? '').startsWith('en'))?.identifier;
        }

        setTtsVoice(voice);
      }).catch(() => {}); // API unavailable on some platforms — silent fallback
    };

    pickAndSetVoice();

    // Web only: re-run the picker when the voice catalog finishes loading.
    // Idempotent — re-running with the same voices just re-sets the same
    // identifier. No-op on native (no window.speechSynthesis).
    const ss =
      typeof window !== 'undefined' && 'speechSynthesis' in window
        ? window.speechSynthesis
        : null;
    if (ss && typeof ss.addEventListener === 'function') {
      const handler = () => pickAndSetVoice();
      ss.addEventListener('voiceschanged', handler);
      return () => ss.removeEventListener('voiceschanged', handler);
    }
  }, [elder?.preferred_lang]);

  // ── TTS ─────────────────────────────────────────────────────────────────────

  const stopSpeech = useCallback(() => {
    Speech.stop();
    setSpeaking(false);
  }, []);

  const speakText = useCallback((text: string) => {
    stopSpeech();
    // Strip markdown + emojis (TTS reads emojis as "smiling face" etc.)
    const clean = text
      .replace(/[*_`#>~]/g, '')
      .replace(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    Speech.speak(clean, {
      language: lang,
      voice: ttsVoice,          // undefined = system default; set to LATAM voice when available
      rate: 0.88,
      pitch: 1.0,
      onStart:   () => setSpeaking(true),
      onDone:    () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError:   () => setSpeaking(false),
    });
  }, [lang, ttsVoice, stopSpeech]);

  useEffect(() => () => { Speech.stop(); }, []);

  // ── History ──────────────────────────────────────────────────────────────────
  // Load the last 10 turns on session start so Nagi doesn't ask the same
  // questions twice. Tries local SQLite first (instant on native), falls
  // back to Supabase (required on web where localDb is a stub, and also
  // covers cross-device — elder picks up where they left off when they
  // switch from tablet to phone).
  //
  // The `cancelled` flag drops a stale fetch if the elder switches mid-load.
  useEffect(() => {
    if (!elder) return;
    let cancelled = false;
    setHistoryLoading(true);
    loadChatHistory(elder.id).then(history => {
      if (cancelled) return;
      if (history.length > 0) {
        setMessages(history);
        setDisplay(history.map((msg, i) => ({
          id:      `history-${i}`,
          role:    msg.role,
          content: msg.content,
        })));
      }
      setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [elder?.id]);

  // ── STT ─────────────────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    stopVoice.current?.();
    setListening(false);
  }, []);

  const handleMic = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }

    if (isSupported()) {
      stopSpeech();
      setListening(true);

      // Auto-cancel after 9s of silence
      silenceTimer.current = setTimeout(() => setListening(false), 9000);

      stopVoice.current = startListening(
        lang,
        (text) => {
          stopListening();
          setVolume(0);
          setInput(text);
          handleSendRef.current(text);
        },
        () => { stopListening(); setVolume(0); },
        (level) => setVolume(level),
      );
      return;
    }

    // Native Expo Go: open keyboard (dictation button available there)
    inputRef.current?.focus();
  }, [listening, lang, stopSpeech, stopListening]);

  // ── Send ─────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || !elder || streaming) return;
      stopSpeech();
      setInput('');

      const userMsg: ChatMessage     = { role: 'user', content: text.trim() };
      const userDisplay: DisplayMsg  = { id: Date.now().toString(), role: 'user', content: text.trim() };
      const nextMessages             = [...messages, userMsg];

      setMessages(nextMessages);
      setDisplay(prev => [...prev, userDisplay]);

      const streamId = (Date.now() + 1).toString();
      setDisplay(prev => [...prev, { id: streamId, role: 'streaming', content: '' }]);
      setStreaming(true);
      streamRef.current = '';

      try {
        await sendChatMessage(elder.id, orgId, nextMessages, elder.preferred_lang, chunk => {
          streamRef.current += chunk;
          setDisplay(prev =>
            prev.map(m => (m.id === streamId ? { ...m, content: streamRef.current } : m)),
          );
          listRef.current?.scrollToEnd({ animated: true });
        });

        const finalContent = streamRef.current;
        setMessages(m => [...m, { role: 'assistant', content: finalContent }]);
        setDisplay(prev =>
          prev.map(m => (m.id === streamId ? { ...m, role: 'assistant', content: finalContent } : m)),
        );
        if (voiceMode) speakText(finalContent);
      } catch {
        const fallback = elder.ui_config.offline_message ?? s.offlineMessage;
        setDisplay(prev =>
          prev.map(m => (m.id === streamId ? { ...m, role: 'assistant', content: fallback } : m)),
        );
        if (voiceMode) speakText(fallback);
        await logActivity(elder.id, orgId, 'offline_ai_unavailable', { screen: 'chat' });
      } finally {
        setStreaming(false);
      }
    },
    [elder, orgId, messages, streaming, voiceMode, speakText, stopSpeech],
  );

  // Keep ref fresh — must be after handleSend is declared
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  // ── UI ───────────────────────────────────────────────────────────────────────

  const bg        = highContrast ? 'bg-charcoal-deep' : 'bg-gray-50';
  const textColor = highContrast ? 'text-paper' : 'text-gray-900';

  // No elder selected at all — neither kiosk nor preview path resolved
  // an id (typically after a page reload, since Zustand state doesn't
  // persist by design and deviceMode hydration may still be pending).
  // Bounce to intermediary; the normal entry into chat is dashboard
  // → tap elder.
  if (!elderId) {
    return <Redirect href="/(intermediary)/" />;
  }

  // Elder is selected but still loading from the backend.
  if (!elder) {
    return (
      <SafeAreaView className="flex-1 bg-surface-elder-raised items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${bg}`}
      style={{ backgroundColor: highContrast ? '#0F0F0F' : '#F7F5F2' }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">

        {/* Header */}
        <View className="px-5 py-3 flex-row items-center border-b border-gray-100">
          <Pressable onPress={() => { stopSpeech(); safeBack('/(elder)/'); }} className="mr-4 p-1">
            <Text className="text-accent-600 text-xl">←</Text>
          </Pressable>
          <Text className={`font-bold ${textColor} text-lg flex-1`}>凪 Nagi</Text>
          <Pressable
            onPress={() => { stopSpeech(); setVoiceMode(v => !v); }}
            className={`px-3 py-1.5 rounded-full ${voiceMode ? 'bg-accent-100' : 'bg-gray-100'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Text className={`text-sm font-medium ${voiceMode ? 'text-accent-700' : 'text-gray-500'}`}>
              {voiceMode ? s.voiceOn : s.voiceOff}
            </Text>
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={display}
          keyExtractor={m => m.id}
          contentContainerStyle={
            display.length === 0
              ? { flex: 1, justifyContent: 'center', padding: 24 }
              : { padding: 16, paddingBottom: 8 }
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            // Suppressed during history fetch so the welcome doesn't flash
            // before Supabase responds with prior turns. Once historyLoading
            // is false and display is still empty, this is a genuinely fresh
            // chat — show the warm hello instead of a blank void.
            historyLoading ? null : (
              <View className="items-center">
                <Text className="text-6xl mb-4" accessible={false}>凪</Text>
                <Text
                  className={`${tc.btn} font-semibold text-center mb-2 ${textColor}`}
                >
                  {s.chatEmptyTitle(elder.display_name)}
                </Text>
                <Text
                  className={`${tc.body} text-center ${highContrast ? 'text-gray-200' : 'text-gray-500'}`}
                >
                  {cardWelcome ?? s.chatEmptySubtitle}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View className={`mb-4 max-w-[82%] ${item.role === 'user' ? 'self-end' : 'self-start'}`}>
              <View
                className={`rounded-2xl px-4 py-3 ${
                  item.role === 'user'
                    ? 'bg-accent-600'
                    : 'bg-surface-elder-raised border border-gray-100'
                }`}
              >
                <Text
                  className={`${tc.body} leading-relaxed ${
                    item.role === 'user' ? 'text-paper' : textColor
                  }`}
                >
                  {item.content || (item.role === 'streaming' ? '…' : '')}
                </Text>
              </View>

              {/* Replay button — only on completed assistant messages */}
              {item.role === 'assistant' && item.content && voiceMode && (
                <Pressable
                  onPress={() => speakText(item.content)}
                  className="mt-1 self-start px-3 py-1 rounded-full bg-gray-100"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-gray-500 text-xs">{s.replay}</Text>
                </Pressable>
              )}
            </View>
          )}
        />

        {/* Listening — waveform bars */}
        {listening && (
          <View className="items-center py-3 gap-2">
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, gap: 5 }}>
              {[0.5, 0.8, 1.0, 0.8, 0.6, 0.9, 0.5].map((seed, i) => (
                <View
                  key={i}
                  style={{
                    width: 5,
                    borderRadius: 3,
                    backgroundColor: volume > 0.05 ? '#34503E' : '#DDE5DF',
                    height: Math.max(6, Math.min(44, volume * 44 * seed + 6)),
                  }}
                />
              ))}
            </View>
            <Text className="text-accent-600 text-sm font-medium">
              {volume > 0.05 ? s.listening : s.waitingVoice}
            </Text>
          </View>
        )}
        {speaking && !listening && (
          <View className="items-center py-2">
            <Text className="text-accent-500 text-xs">{s.nagiSpeaking}</Text>
          </View>
        )}

        {/* Input area */}
        <View className="px-4 pb-3 pt-2 bg-surface-elder-raised border-t border-gray-100 gap-3">

          {/* Mic button */}
          {voiceMode && (
            <Pressable
              onPress={handleMic}
              disabled={streaming}
              className={`self-center items-center justify-center w-20 h-20 rounded-full shadow-sm ${
                listening ? 'bg-red-500' : 'bg-accent-600'
              }`}
              style={({ pressed }) => ({ opacity: streaming ? 0.4 : pressed ? 0.82 : 1 })}
            >
              <Text className="text-paper text-3xl">{listening ? '■' : '◉'}</Text>
              <Text className="text-paper text-xs mt-0.5">
                {listening ? s.stop : s.speak}
              </Text>
            </Pressable>
          )}

          {/* Text input */}
          <View className="flex-row items-end gap-2">
            <TextInput
              ref={inputRef}
              className={`flex-1 border border-gray-200 rounded-2xl px-4 py-3 ${tc.input} ${textColor} bg-gray-50`}
              placeholder={voiceMode ? s.orTypeHere : s.typeHere}
              placeholderTextColor="#9ca3af"
              value={input}
              onChangeText={text => { stopSpeech(); setInput(text); }}
              multiline
              editable={!streaming}
              onSubmitEditing={() => handleSend(input)}
            />
            <Pressable
              onPress={() => handleSend(input)}
              disabled={streaming || !input.trim()}
              className="bg-accent-600 rounded-xl px-4 py-3"
              style={({ pressed }) => ({ opacity: streaming || !input.trim() ? 0.4 : pressed ? 0.82 : 1 })}
            >
              {streaming
                ? <ActivityIndicator color="white" size="small" />
                : <Text className="text-paper font-semibold">→</Text>
              }
            </Pressable>
          </View>

          {/* Emergency */}
          <Pressable
            onPress={() => {
              // Fire help request immediately — don't wait for outbox drain
              if (elder) {
                createHelpRequest(elder.id, orgId).catch(() => {});
              }
              // Let Nagi respond with emotional support in parallel
              handleSend(s.urgentHelpPrime);
            }}
            className="bg-safety-critical-soft rounded-xl py-3.5 items-center border border-safety-critical-border"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className={`text-safety-critical font-bold ${tc.btn}`}>{s.needHelp}</Text>
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
