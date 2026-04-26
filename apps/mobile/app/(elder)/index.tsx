import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeBack } from '@/lib/nav';
import { logActivity } from '@/features/activity-log';
import { DailyShareToggle } from '@/features/privacy/DailyShareToggle';
import { listUnreadForElder } from '@/features/messages';
import { useDueReminder } from '@/features/reminders';
import { useStrings } from '@/lib/i18n';
import { useElderCtx } from './_layout';
import { WELCOME_SEEN_KEY } from './welcome';

const CARD_EMOJIS = {
  call_family:   '📞',
  get_help:      '🙋',
  my_day:        '☀️',
  one_task:      '✅',
  pastimes:      '🌿',
  proud_moments: '✨',
} as const;

type CardKey = keyof typeof CARD_EMOJIS;

const TEXT_CLASS = {
  lg:  { heading: 'text-3xl', card: 'text-lg',  btn: 'text-xl' },
  xl:  { heading: 'text-4xl', card: 'text-xl',  btn: 'text-2xl' },
  '2xl': { heading: 'text-5xl', card: 'text-2xl', btn: 'text-3xl' },
};

/**
 * Card label for the unread-messages pill. Single message vs many,
 * with named sender when available. Lang-aware.
 */
function messageCardLabel(lang: string, fromName: string | null, count: number): string {
  if (lang === 'es') {
    if (count === 1 && fromName) return `📬 Mensaje de ${fromName}`;
    if (count === 1) return `📬 Tienes un mensaje nuevo`;
    return `📬 Tienes ${count} mensajes nuevos`;
  }
  if (lang === 'pt') {
    if (count === 1 && fromName) return `📬 Mensagem de ${fromName}`;
    if (count === 1) return `📬 Você tem uma mensagem nova`;
    return `📬 Você tem ${count} mensagens novas`;
  }
  if (count === 1 && fromName) return `📬 Message from ${fromName}`;
  if (count === 1) return `📬 You have a new message`;
  return `📬 You have ${count} new messages`;
}

export default function ElderHome() {
  const { elder, textSize, highContrast, orgId } = useElderCtx();
  const s = useStrings(elder?.preferred_lang);
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadFromName, setUnreadFromName] = useState<string | null>(null);
  const dueReminder = useDueReminder(elder?.id);

  // First-open gate: redirect to welcome if not yet seen on this device.
  // Single AsyncStorage key, no schema change. See app/(elder)/welcome.tsx.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then(value => {
        if (cancelled) return;
        if (value !== 'true') router.replace('/(elder)/welcome');
      })
      .catch(() => {}); // Storage failure: stay on home, welcome will show next launch.
    return () => { cancelled = true; };
  }, []);

  // Cross-tenant message inbox count. We only fetch the count + the
  // first sender's name for the home pill — full list lives on the
  // dedicated /(elder)/messages route.
  useEffect(() => {
    if (!elder) return;
    let cancelled = false;
    void listUnreadForElder(elder.id).then(async unread => {
      if (cancelled) return;
      setUnreadCount(unread.length);
      if (unread.length > 0) {
        // Resolve first sender's name for the card label.
        const firstFrom = unread[0].from_elder_id;
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data } = await supabase
            .from('elders')
            .select('display_name, profile')
            .eq('id', firstFrom)
            .single();
          if (cancelled) return;
          const profile = (data as { profile?: Record<string, unknown> } | null)?.profile;
          const name =
            (profile?.preferred_name as string | undefined) ??
            (data as { display_name?: string } | null)?.display_name?.split(' ')[0] ??
            null;
          setUnreadFromName(name);
        } catch { /* best effort */ }
      } else {
        setUnreadFromName(null);
      }
    });
    return () => { cancelled = true; };
  }, [elder]);

  if (!elder) {
    return (
      <SafeAreaView className="flex-1 bg-surface-elder-raised items-center justify-center">
        <ActivityIndicator color="#34503E" />
      </SafeAreaView>
    );
  }

  const tc = TEXT_CLASS[textSize];
  // Merge configured cards with any newly-added cards the elder's
  // ui_config doesn't yet list. Existing elders seeded before D + F
  // shipped have ui_config.home_cards = [call_family, get_help, my_day,
  // one_task] — without this merge the new pastimes + proud_moments
  // tiles never appear. Append-only: configured order is preserved,
  // new keys land at the end. If a caregiver later removes a card
  // explicitly via UI, that intent is captured by an explicit "hidden"
  // list in a follow-up; for now, all known cards show.
  const allCards = Object.keys(CARD_EMOJIS) as CardKey[];
  const configured = (elder.ui_config.home_cards as CardKey[] | undefined);
  const cardKeys: CardKey[] = configured
    ? [...configured, ...allCards.filter(k => !configured.includes(k))]
    : allCards;
  const bg = highContrast ? 'bg-charcoal-deep' : 'bg-surface-elder-raised';
  const textColor = highContrast ? 'text-paper' : 'text-gray-900';
  const cardBg = highContrast ? 'bg-gray-900 border-gray-600' : 'bg-accent-50 border-accent-100';

  // TODO: source intermediaryName from session/membership when intermediary identity
  // is wired into the elder context (see DESIGN_APP §3.4).
  const intermediaryName: string | undefined = undefined;

  const handleCard = async (key: CardKey) => {
    const cardStr = s.cards[key] ?? s.cards.get_help;
    await logActivity(elder.id, orgId, 'ui_action', { action: key, screen: 'home' });
    // Pass cardKey so chat can render the per-tile welcome banner
    // ("Share with me something lovely…", etc.). All tiles route to the
    // same chat screen but each one carries its own framing.
    router.push({ pathname: '/(elder)/chat', params: { prime: cardStr.prime, cardKey: key } });
  };

  const handleHelp = async () => {
    await logActivity(elder.id, orgId, 'ui_action', { action: 'emergency_help', screen: 'home' });
    router.push({ pathname: '/(elder)/chat', params: { prime: s.urgentHelpPrime } });
  };

  return (
    <SafeAreaView
      className={`flex-1 ${bg}`}
      style={{ backgroundColor: highContrast ? '#0F0F0F' : '#FAF5EC' }}
    >
      <View className="flex-1 px-6 pt-8 pb-4">
        {/* Exit to intermediary dashboard — only visible when pushed from that flow */}
        {canGoBack && (
          <Pressable
            onPress={() => safeBack('/(intermediary)/')}
            className="self-start mb-4 px-2 py-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="text-accent-600 text-sm font-medium">← Exit</Text>
          </Pressable>
        )}
        <Text className={`${tc.heading} font-bold ${textColor} text-center mb-2`}>
          {s.greeting(elder.display_name.split(' ')[0])}
        </Text>
        <Text className="text-accent-500 text-center mb-8 text-base">{s.subtitle}</Text>

        <View className="flex-row flex-wrap gap-4 mb-auto">
          {cardKeys.map(key => {
            const cardStr = s.cards[key];
            if (!cardStr) return null;
            return (
              <Pressable
                key={key}
                onPress={() => handleCard(key)}
                className={`rounded-3xl border items-center justify-center ${cardBg}`}
                style={({ pressed }) => [{ width: '47%', aspectRatio: 1 }, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-5xl mb-2">{CARD_EMOJIS[key]}</Text>
                <Text className={`${tc.card} font-semibold ${textColor} text-center px-2`}>
                  {cardStr.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {dueReminder && (
          <Pressable
            onPress={() => router.push({
              pathname: '/(elder)/reminder/[eventId]',
              params: { eventId: dueReminder.event.id },
            })}
            className="mt-4 bg-accent-100 rounded-2xl py-4 items-center border-2 border-accent-500"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className={`text-accent-ink font-bold ${tc.card}`}>
              {s.pillReminderHome(dueReminder.reminder.label)}
            </Text>
          </Pressable>
        )}

        {unreadCount > 0 && (
          <Pressable
            onPress={() => router.push('/(elder)/messages')}
            className="mt-4 bg-accent-100 rounded-2xl py-4 items-center border-2 border-accent-500"
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Text className={`text-accent-ink font-bold ${tc.card}`}>
              {messageCardLabel(elder.preferred_lang, unreadFromName, unreadCount)}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleHelp}
          className="mt-6 bg-safety-critical-soft rounded-2xl py-5 items-center border-2 border-safety-critical-border"
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Text className={`text-safety-critical font-bold ${tc.btn}`}>{s.needHelp}</Text>
        </Pressable>

        <View style={{ marginTop: 24, marginBottom: 8 }}>
          <DailyShareToggle
            elderId={elder.id}
            lang={elder.preferred_lang}
            highContrast={highContrast}
          />
        </View>

        <Text className="text-base text-neutral-500 text-center mb-2 mt-4">
          {s.preparedBy(intermediaryName ?? s.companion)}
        </Text>
      </View>
    </SafeAreaView>
  );
}
